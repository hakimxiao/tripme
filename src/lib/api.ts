import { Trip } from "@/db/schema";
import { TripStatus } from "@/lib/trip-status";

// Client-side helpers for the Expo Router API routes. In development, relative
// paths automatically resolve to the dev server origin (Expo Router), so no base
// URL is needed. Each request carries the Clerk session token as a Bearer header.
//
// `getToken` comes from `useAuth().getToken` (Clerk). Keep this file free of any
// server-only imports so it never pulls secrets into the client bundle.

type GetToken = () => Promise<string | null>;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authedFetch(
  getToken: GetToken,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let message = `Request failed (${res.status})`;

      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        // non-JSON error body — keep the default message
      }
      throw new ApiError(message, res.status);
    }

    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new ApiError("Waktu permintaan habis (timeout). Silakan periksa koneksi internet Anda atau coba lagi.", 408);
    }
    throw error;
  }
}

export type CreateTripInput = {
  destination: string;
  startDate: string; //YYY-MM-DD
  numDays: number;
  numTravelers: number;
  budgetTier: "ekonomis" | "nyaman" | "mewah";
  interests: string[];
  pace: string | null;
};

// Creates a trip (status `pending`) and kicks off background generation.\
export async function createTrip(
  getToken: GetToken,
  input: CreateTripInput,
): Promise<{ id: string; status: TripStatus }> {
  const res = await authedFetch(getToken, "/api/trips", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return res.json();
}

// Polls a trip's generation status.
export async function getTripStatus(
  getToken: GetToken,
  id: string,
): Promise<{ status: TripStatus; errorMessage: string | null }> {
  const res = await authedFetch(getToken, `/api/trips/${id}/status`);

  return res.json();
}

// Fetches the full trip for the detail screen.
export async function getTrip(getToken: GetToken, id: string): Promise<Trip> {
  const res = await authedFetch(getToken, `/api/trips/${id}`);

  return res.json();
}

// Deletes a trip (and its chat messages, via cascade).
export async function deleteTrip(
  getToken: GetToken,
  id: string,
): Promise<void> {
  await authedFetch(getToken, `/api/trips/${id}`, { method: "DELETE" });
}

// Replaces a trip's cover image with a user-picked photo (raw base64). Returns the
// new ImageKit-hosted URL.
export async function updateTripCover(
  getToken: GetToken,
  id: string,
  imageBase64: string,
): Promise<{ coverImageUrl: string }> {
  const res = await authedFetch(getToken, `/api/trips/${id}/cover`, {
    method: "PATCH",
    body: JSON.stringify({ imageBase64 }),
  });
  return res.json();
}
