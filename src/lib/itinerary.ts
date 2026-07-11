import { z } from "zod";

// Shapes for the AI-generated `itinerary` and `budgetBreakdown` jsonb columns.
// These schemas do double duty: they validate the model output (via Zod) AND drive
// OpenAI Structured Outputs (via `zodResponseFormat`). For strict Structured Outputs
// every field must be required and present, so avoid `.optional()` here — use
// `.nullable()` when a value can be genuinely absent.

export const placeKindEnum = z.enum(["attraction", "restaurant", "activity"]);

// A single stop within a day — attraction, restaurant, or activity.
// lat/lng are LLM-estimated (see PLAN assumption A1) and drive the map pins.
export const placeSchema = z.object({
  name: z.string(),
  kind: placeKindEnum,
  description: z.string(),
  // Rough time of day so the UI can order/group stops.
  timeOfDay: z.enum(["morning", "afternoon", "evening"]),
  latitude: z.number(),
  longitude: z.number(),
});

export const daySchema = z.object({
  day: z.number().int(),
  title: z.string(),
  summary: z.string(),
  places: z.array(placeSchema),
});

export const hotelSchema = z.object({
  name: z.string(),
  description: z.string(),
  // Human-readable nightly estimate, e.g. "$120 / night".
  priceEstimate: z.string(),
  latitude: z.number(),
  longitutde: z.number(),
});

export const itinerarySchema = z.object({
  // One-line trip overview.
  summary: z.string(),
  days: z.array(daySchema),
  hotels: z.array(hotelSchema),
});

export const budgetCategorySchema = z.object({
  // e.g. "Accommodation", "Food", "Activities", "Transport".
  name: z.string(),
  amountPerPerson: z.number(),
  note: z.string(),
});

export const budgetBreakdownSchema = z.object({
  // ISO currency code, e.g. "USD".
  currency: z.string(),
  totalPerPerson: z.number(),
  categories: z.array(budgetCategorySchema),
});

// The full object we ask the model to return in one shot.
export const tripGenerationSchema = z.object({
  itinerary: itinerarySchema,
  budgetBreakdown: budgetBreakdownSchema,
});

export type Place = z.infer<typeof placeSchema>;
export type Day = z.infer<typeof daySchema>;
export type Hotel = z.infer<typeof hotelSchema>;
export type Itinerary = z.infer<typeof itinerarySchema>;
export type BudgetBreakdown = z.infer<typeof budgetBreakdownSchema>;
export type TripGeneration = z.infer<typeof tripGenerationSchema>;
