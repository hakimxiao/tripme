// Trip generation lifecycle. Shared between client screens and server code so both
// agree on the status strings. Kept in its own module (no drizzle/server imports)
// so the client can use it without pulling in the DB layer.
export type TripStatus = "pending" | "generating" | "ready" | "failed";
