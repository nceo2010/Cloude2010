import Anthropic from "@anthropic-ai/sdk";

import type {
  AiMessage,
  ChatProvider,
  StreamChatParams,
} from "@/lib/ai/provider";

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

function resolveModel(): string {
  const configured = process.env.ANTHROPIC_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_MODEL;
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

  async *streamChat({
    system,
    messages,
    signal,
  }: StreamChatParams): AsyncIterable<string> {
    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: MAX_TOKENS,
        // Thinking off: snappier first token and lower cost for casual chat.
        // Switch to { type: "adaptive" } if deeper reasoning is ever needed.
        thinking: { type: "disabled" },
        system,
        messages: messages as Anthropic.MessageParam[],
      },
      { signal },
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
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
