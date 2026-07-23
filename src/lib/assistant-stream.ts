// Shared wire protocol for the assistant chat stream, imported by both the API
// route (server) and the client streaming helper. Keep this file free of any
// server- or client-only imports so both sides can safely depend on it.
//
// The response body is the assistant's reply as a plain-text token stream, then a
// single record-separator control char (U+001E) followed by a JSON metadata frame
// carrying token usage and the concrete model. The separator never appears in the
// model's text output, so the client can split the reply from the metadata cleanly.
export const ASSISTANT_META_SEPARATOR = "\u001e";

// Trailing metadata used to enrich the client-side Sentry AI-agent span. All
// fields are optional — the client sets only the attributes that are present.
export type AssistantStreamMeta = {
  model: string | null;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
  } | null;
};
