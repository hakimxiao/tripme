import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { serverEnv } from "./env";
import {
  budgetBreakdownSchema,
  daySchema,
  hotelSchema,
  TripGeneration,
  type Day,
} from "./itinerary";

// Mini tier everywhere (see PLAN spec). Structured Outputs are supported on this model.
const MODEL = "gpt-4o-mini";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: serverEnv.openaiApiKey });
  return client;
}

export type TripPlanInput = {
  destination: string;
  startDate: string; // YYYY-MM-DD
  numDays: number;
  numTravelers: number;
  budgetTier: "ekonomis" | "nyaman" | "mewah";
  interests: string[];
  pace: string | null;
};

const BUDGET_GUIDANCE: Record<TripPlanInput["budgetTier"], string> = {
  ekonomis:
    "budget-conscious: hostels/3-star stays, street food and casual eateries, mostly free or low-cost attractions",
  nyaman:
    "mid-range: comfortable 3-4 star hotels, a mix of casual and nicer restaurants, paid attractions where worthwhile",
  mewah:
    "luxury: 4-5 star hotels and standout stays, fine dining, premium experiences and private tours",
};

// Trip-level details that aren't day-specific (returned by a single call).
const tripMetaSchema = z.object({
  summary: z.string(),
  hotels: z.array(hotelSchema),
  budgetBreakdown: budgetBreakdownSchema,
});
type TripMeta = z.infer<typeof tripMetaSchema>;

// Returns "YYYY-MM-DD" for `startDate` (YYYY-MM-DD) plus `offset` days. Parsed as
// UTC so the date arithmetic never shifts across a DST/timezone boundary.
function addDays(startDate: string, offset: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);

  return d.toISOString().slice(0, 10);
}

// Shared trip context lines reused across the per-day and meta prompts.
function contextLines(input: TripPlanInput): string {
  const interestLine = input.interests.length
    ? input.interests.join(", ")
    : "general sightseeing";
  const paceLine = input.pace ? `${input.pace} pace` : "a balanced pace";

  return [
    `Destination: ${input.destination}`,
    `Travelers: ${input.numTravelers}`,
    `Budget tier: ${BUDGET_GUIDANCE[input.budgetTier]}`,
    `Interests / style: ${interestLine}`,
    `Preferred pace: ${paceLine}`,
  ].join("\n");
}

// Generates ONE day of the itinerary. We generate day-by-day (rather than asking for
// all N days in a single call) because mini models unreliably honor the requested day
// count for a deeply nested schema — a single-day request is always respected, so the
// caller controls the total count exactly.
async function generateDay(
  input: TripPlanInput,
  dayNumber: number,
  date: string,
  usedPlaces: string[],
  usedTitles: string[],
): Promise<Day> {
  const system = [
    "You are an expert travel planner designing ONE day of a longer trip.",
    "Return exactly one day with 3-5 places (a mix of attractions, restaurants and activities) ordered morning → afternoon → evening.",
    "Use real, well-known places that actually exist at the destination, with accurate latitude/longitude. Keep descriptions to 1-2 sentences.",
    'Give the day a distinct, specific title tied to a neighborhood, district or theme (e.g. "Historic Asakusa & the Sumida River") — avoid generic titles like "Cultural Delights".',
  ].join("\n");

  const user = [
    contextLines(input),
    "",
    `Plan Day ${dayNumber} of ${input.numDays} (date: ${date}).`,
    usedPlaces.length
      ? `Do NOT reuse any of these places already planned on other days: ${usedPlaces.join(", ")}.`
      : "This is the first day planned so far.",
    usedTitles.length
      ? `Give this day a title clearly different from the earlier days: ${usedTitles.join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await getClient().chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(daySchema, "itinerary_day"),
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal)
    throw new Error(`Model refused (day ${dayNumber}): ${message.refusal}`);
  if (!message?.parsed)
    throw new Error(`Model returned no plan for day b${dayNumber}.`);

  return daySchema.parse(message.parsed);
}

// Generates the trip-level summary, hotel suggestions and budget breakdown.
async function generateMeta(input: TripPlanInput): Promise<TripMeta> {
  const system = [
    "You are an expert travel planner.",
    "Provide a one-sentence trip summary, 2-3 hotel suggestions appropriate to the budget tier (with accurate latitude/longitude), and a per-person budget breakdown in USD reflecting the budget tier and destination cost of living.",
    "Keep descriptions concise.",
  ].join("\n");

  const user = [
    contextLines(input),
    "",
    `Trip length: ${input.numDays} day(s).`,
  ].join("\n");

  const completion = await getClient().chat.completions.parse({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: zodResponseFormat(tripMetaSchema, "trip_meta"),
  });

  const message = completion.choices[0]?.message;
  if (message?.refusal)
    throw new Error(`Model refused (meta): ${message.refusal}`);
  if (!message?.parsed) throw new Error("Model returned no trip meta.");

  return tripMetaSchema.parse(message.parsed);
}

// Produces a validated itinerary + budget breakdown for the trip. The trip meta and
// the per-day plans are generated as separate calls: meta runs concurrently while the
// days are generated sequentially so each day can avoid places used on earlier days.
export async function generateTripPlan(
  input: TripPlanInput,
): Promise<TripGeneration> {
  const { startDate, numDays, destination } = input;

  const metaPromise = generateMeta(input);

  const days: Day[] = [];
  const usedPlaces: string[] = [];
  const usedTitles: string[] = [];

  for (let i = 0; i < numDays; i++) {
    const day = await generateDay(
      input,
      i + 1,
      addDays(startDate, i),
      usedPlaces,
      usedTitles,
    );
    // Enforce sequential numbering regardless of what the model returned.
    day.day = i + 1;
    days.push(day);
    usedPlaces.push(...day.places.map((p) => p.name));
    usedTitles.push(day.title);
  }

  const meta = await metaPromise;

  // Guaranteed by the loop, but assert to catch any future regression.
  if (days.length !== numDays) {
    throw new Error(
      `Built ${days.length} day(s) but ${numDays} were requested for ${destination}.`,
    );
  }

  return {
    itinerary: {
      summary: meta.summary,
      days,
      hotels: meta.hotels,
    },
    budgetBreakdown: meta.budgetBreakdown,
  };
}
