import { Inngest } from "inngest";

// Dev-only setup: `isDev` forces dev mode so no INNGEST_EVENT_KEY /
// INNGEST_SIGNING_KEY is needed and signature validation is skipped.
// Events go to the local Inngest dev server.

export const inngest = new Inngest({
  id: "tripme",
  isDev: true,
});

export const CLERK_USER_CREATED = "clerk/user.created" as const;
export const CLERK_USER_UPDATED = "clerk/user.updated" as const;
export const CLERK_USER_DELETED = "clerk/user.deleted" as const;

// Payload for CLERK_USER_CREATED — shared by the webhook (sender) and the
// Inngest function (consumer) so both ends agree on the shape.
export type ClerkUserCreatedData = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

// user.updated carries the same fields as user.created (it's a full upsert).
export type ClerkUserUpdatedData = ClerkUserCreatedData;

// user.deleted only gives us the id of the removed Clerk user.
export type ClerkUserDeletedData = {
  id: string;
};
