import { db } from "@/db";
import { trips, users } from "@/db/schema";
import { generateTripCoverImage } from "@/lib/images";
import { generateTripPlan } from "@/lib/openai";
import { refundGeneration, usageDay } from "@/lib/usage";
import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import {
  CLERK_USER_CREATED,
  CLERK_USER_DELETED,
  CLERK_USER_UPDATED,
  inngest,
  TRIP_GENERATE,
  type ClerkUserCreatedData,
  type ClerkUserDeletedData,
  type ClerkUserUpdatedData,
  type TripGenerateData,
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

// The durable trip-generation pipeline. Triggered by `POST /api/trips` after a
// `pending` row is created. Steps are individually retried by Inngest; if the whole
// run exhausts its retries, `onFailure` marks the trip `failed` and refunds quota.
export const generateTrip = inngest.createFunction(
  {
    id: "generate-trip",
    // 2 retries → up to 3 attempts before terminal failure.
    retries: 2,
    onFailure: async ({ event, step }) => {
      // The failure event wraps the original event under `data.event`.
      const failure = event.data as {
        error?: { message?: string };
        event: { data: TripGenerateData };
      };
      const { tripId, userId } = failure.event.data;
      // Keep the raw failure only in internal logs — never surface it to clients.
      console.error(
        `[generate-trip] run failed for ${tripId}:`,
        failure.error?.message,
      );
      // Generic, user-safe message persisted for the status API to expose.
      const message = "Trip generation failed. Please try again.";

      await step.run("mark-failed", async () => {
        // Refund the reserved generation so a failed trip doesn't burn the daily cap.
        const [trip] = await db
          .select({ createdAt: trips.createdAt })
          .from(trips)
          .where(eq(trips.id, tripId));

        await db
          .update(trips)
          .set({
            status: "failed",
            errorMessage: message,
            updatedAt: new Date(),
          })
          .where(eq(trips.id, tripId));

        if (trip) {
          await refundGeneration(userId, usageDay(trip.createdAt));
        }
      });
    },
    triggers: [{ event: TRIP_GENERATE }],
  },

  async ({ event, step }) => {
    const { tripId } = event.data as TripGenerateData;

    // Flip to `generating` and read back the generation inputs from the row.
    const trip = await step.run("set-generating", async () => {
      const [row] = await db
        .update(trips)
        .set({ status: "generating", updatedAt: new Date() })
        .where(eq(trips.id, tripId))
        .returning();

      // No point retrying if the trip row is gone (e.g. deleted mid-flight).
      if (!row) throw new NonRetriableError(`Trip ${tripId} not found`);
      return row;
    });

    // Ask OpenAI for the structured itinerary + budget breakdown.
    const plan = await step.run("generate-plan", () =>
      generateTripPlan({
        destination: trip.destination,
        startDate: trip.startDate,
        numDays: trip.numDays,
        numTravelers: trip.numTravelers,
        budgetTier: trip.budgetTier,
        interests: trip.interests,
        pace: trip.pace,
      }),
    );

    // Best-effort cover image: a failure here shouldn't fail the whole trip.
    const cover = await step.run("cover-image", async () => {
      try {
        return await generateTripCoverImage(trip.destination, tripId);
      } catch (error) {
        console.error(
          `[generate-trip] cover image failed for ${tripId}:`,
          error,
        );
        return null;
      }
    });

    // Persist the results and mark the trip ready.
    await step.run("persist", async () => {
      await db
        .update(trips)
        .set({
          status: "ready",
          itinerary: plan.itinerary,
          budgetBreakdown: plan.budgetBreakdown,
          coverImageUrl: cover?.url ?? null,
          coverPhotographer: cover?.photographer ?? null,
          coverPhotographerUrl: cover?.photographerUrl ?? null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(trips.id, tripId));
    });

    return { tripId, status: "ready" };
  },
);

export const functions = [
  syncUserCreated,
  syncUserUpdated,
  syncUserDeleted,
  generateTrip,
];
