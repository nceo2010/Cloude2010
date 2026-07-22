import Anthropic from "@anthropic-ai/sdk";

import type {
  AiMessage,
  ChatProvider,
  ChatStreamResult,
  JourneySuggestionProposal,
  StreamChatParams,
} from "@/lib/ai/provider";
import { isJourneySuggestionField, JOURNEY_SUGGESTION_FIELDS } from "@/lib/journeys/types";

/**
 * The ONLY module that imports the Anthropic SDK. Everything else depends on
 * the `ChatProvider` interface, so swapping providers means adding a sibling
 * file — not editing callers.
 *
 * Server-only: reads `ANTHROPIC_API_KEY` (never exposed to the client) and an
 * optional `ANTHROPIC_MODEL` override.
 */

// Verified current Sonnet model id (see the Claude API model catalog). Used as
// the fallback when ANTHROPIC_MODEL is not set.
const DEFAULT_MODEL = "claude-sonnet-5";

// Chat replies are short; a modest cap keeps latency and cost predictable.
const MAX_TOKENS = 2048;

const SUGGEST_JOURNEY_UPDATE_TOOL_NAME = "suggest_journey_update";
const MAX_SUGGESTION_VALUE_LENGTH = 500;

const SUGGEST_JOURNEY_UPDATE_TOOL: Anthropic.Tool = {
  name: SUGGEST_JOURNEY_UPDATE_TOOL_NAME,
  description:
    "Propose ONE update to a single field of the user's active Journey, for the user to review and explicitly accept or dismiss in the UI — calling this never changes anything by itself and is not visible to the user as text. Call it immediately, in the same reply, whenever the user explicitly states a new value (real progress stated, a new next step, a change of stage or goal) — do not ask the user to confirm in your reply text first; the tool call itself is the confirmation step. Use it at most once per reply. Never call it for greetings, small talk, or speculative changes.",
  input_schema: {
    type: "object",
    properties: {
      field: {
        type: "string",
        enum: [...JOURNEY_SUGGESTION_FIELDS],
        description: "Which Journey field to propose changing.",
      },
      suggestedValue: {
        type: "string",
        description:
          "The proposed new value as plain text. For progress_percentage, a whole number from 0 to 100 written as a string.",
      },
    },
    required: ["field", "suggestedValue"],
  },
};

function resolveModel(): string {
  const configured = process.env.ANTHROPIC_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_MODEL;
}

/** Parses + validates a tool call's raw JSON input. Returns null when malformed. */
function parseSuggestionProposal(raw: string): JourneySuggestionProposal | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { field, suggestedValue } = parsed as Record<string, unknown>;
  if (typeof field !== "string" || !isJourneySuggestionField(field)) return null;
  if (typeof suggestedValue !== "string") return null;

  const trimmed = suggestedValue.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SUGGESTION_VALUE_LENGTH) {
    return null;
  }

  return { field, suggestedValue: trimmed };
}

class AnthropicChatProvider implements ChatProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    }
    this.client = new Anthropic({ apiKey });
    this.model = resolveModel();
  }

  streamChat({
    system,
    messages,
    signal,
    allowJourneySuggestion,
  }: StreamChatParams): ChatStreamResult {
    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: MAX_TOKENS,
        // Thinking off: snappier first token and lower cost for casual chat.
        // Switch to { type: "adaptive" } if deeper reasoning is ever needed.
        thinking: { type: "disabled" },
        system,
        messages: messages as Anthropic.MessageParam[],
        ...(allowJourneySuggestion
          ? { tools: [SUGGEST_JOURNEY_UPDATE_TOOL] }
          : {}),
      },
      { signal },
    );

    let resolveSuggestion!: (value: JourneySuggestionProposal | null) => void;
    const suggestion = new Promise<JourneySuggestionProposal | null>(
      (resolve) => {
        resolveSuggestion = resolve;
      },
    );

    async function* textStream(): AsyncIterable<string> {
      // Tool-use content blocks stream as their own sequence of events,
      // identified by index — not interleaved token-by-token with text, but
      // not guaranteed to be last either, so both are tracked independently.
      const toolNames = new Map<number, string>();
      const toolInputs = new Map<number, string>();
      let captured: JourneySuggestionProposal | null = null;

      for await (const event of stream) {
        if (
          event.type === "content_block_start" &&
          event.content_block.type === "tool_use"
        ) {
          toolNames.set(event.index, event.content_block.name);
          toolInputs.set(event.index, "");
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield event.delta.text;
          } else if (event.delta.type === "input_json_delta") {
            toolInputs.set(
              event.index,
              (toolInputs.get(event.index) ?? "") + event.delta.partial_json,
            );
          }
        } else if (event.type === "content_block_stop") {
          // Only the first tool call that also passes validation is kept —
          // every later block, valid or not, is silently discarded.
          if (
            captured === null &&
            toolNames.get(event.index) === SUGGEST_JOURNEY_UPDATE_TOOL_NAME
          ) {
            captured = parseSuggestionProposal(toolInputs.get(event.index) ?? "");
          }
        }
      }

      resolveSuggestion(captured);
    }

    return { text: textStream(), suggestion };
  }
}

let provider: ChatProvider | null = null;

/** Returns the configured chat provider. Server-only; constructs lazily. */
export function getChatProvider(): ChatProvider {
  if (!provider) {
    provider = new AnthropicChatProvider();
  }
  return provider;
}

// Re-export so route code can import the message type from one place.
export type { AiMessage };
