import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  CLERK_USER_CREATED,
  CLERK_USER_DELETED,
  CLERK_USER_UPDATED,
  type ClerkUserCreatedData,
  type ClerkUserDeletedData,
  type ClerkUserUpdatedData,
  inngest,
} from "./client";

// Consumes `clerk/user.created` and inserts the user into Neon.
// onConflictDoUpdate makes it idempotent so Inngest retries / duplicate
// webhook deliveries don't error or create duplicates.
export const syncUserCreated = inngest.createFunction(
  {
    id: "sync-user-created",
    triggers: [{ event: CLERK_USER_CREATED }],
  },
  async ({ event, step }) => {
    const { id, email, imageUrl, name } = event.data as ClerkUserCreatedData;

    await step.run("insert-user", async () => {
      await db
        .insert(users)
        .values({ id, name, email, imageUrl })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, name, imageUrl, updatedAt: new Date() },
        });
    });

    return { userId: id };
  },
);

// Consumes `clerk/user.updated` and upserts the latest user fields into Neon.
// Same upsert as create so it's idempotent and self-heals if the create
// webhook was ever missed.
export const syncUserUpdated = inngest.createFunction(
  {
    id: "sync-user-updated",
    triggers: [{ event: CLERK_USER_UPDATED }],
  },
  async ({ event, step }) => {
    const { email, id, imageUrl, name } = event.data as ClerkUserUpdatedData;

    await step.run("upsert-user", async () => {
      await db
        .insert(users)
        .values({ id, name, email, imageUrl })
        .onConflictDoUpdate({
          target: users.id,
          set: { email, name, imageUrl, updatedAt: new Date() },
        });
    });

    return { userId: id };
  },
);

// Consumes `clerk/user.deleted` and removes the user from Neon.
// Idempotent: deleting an already-absent row is a no-op, so retries / duplicate
// webhook deliveries don't error.
export const syncUserDeleted = inngest.createFunction(
  {
    id: "sync-user-deleted",
    triggers: [{ event: CLERK_USER_DELETED }],
  },
  async ({ event, step }) => {
    const { id } = event.data as ClerkUserDeletedData;

    await step.run("delete-user", async () => {
      await db.delete(users).where(eq(users.id, id));
    });
    return { userId: id };
  },
);

export const functions = [syncUserCreated, syncUserUpdated, syncUserDeleted];
