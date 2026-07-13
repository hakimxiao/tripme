import { db } from "@/db";
import { generationUsage } from "@/db/schema";
import { sql } from "drizzle-orm";

// Silent safety cap: max trip generations per user per calendar day (UTC).
// Not surfaced in the UI (see PLAN assumption A3) — exceeding it returns a soft error.
export const DAILY_GENERATION_CAP = 20;

// Calendar day (UTC) as YYYY-MM-DD.
export function usageDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// Atomically reserves one generation for today against the daily cap.
// Returns true if reserved (under cap), false if the user is at the cap.
//
// Implemented as an upsert with a conditional increment: the row is inserted at
// count=1 on first use, and incremented only while `count < cap`. When the cap is
// hit, the conditional UPDATE affects no row and RETURNING comes back empty.
export async function reserveGeneration(userId: string): Promise<boolean> {
  const day = usageDay();
  const rows = await db
    .insert(generationUsage)
    .values({ userId, day, count: 1 })
    .onConflictDoUpdate({
      target: [generationUsage.userId, generationUsage.day],
      set: { count: sql`${generationUsage.count} + 1` },
      setWhere: sql`${generationUsage.count} < ${DAILY_GENERATION_CAP}`,
    })
    .returning({ count: generationUsage.count });

  return rows.length > 0;
}

// Refunds a previously reserved generation for the given day (floored at 0).
// Used when generation terminally fails so a failed trip doesn't consume quota
// (see PLAN: "terminal failure → failed, quota untouched").
export async function refundGeneration(
  userId: string,
  day: string,
): Promise<void> {
  await db
    .update(generationUsage)
    .set({ count: sql`GREATEST(${generationUsage.count} - 1, 0)` })
    .where(
      sql`${generationUsage.userId} = ${userId} AND ${generationUsage.day} = ${day}`,
    );
}
