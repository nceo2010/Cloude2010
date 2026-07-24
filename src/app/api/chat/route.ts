import { NextResponse, type NextRequest } from "next/server";

import { getChatProvider } from "@/lib/ai/anthropic";
import { formatJourneyContext, retrieveJourneyContext } from "@/lib/ai/journey-context";
import { formatMemoryContext, retrieveMemoryContext } from "@/lib/ai/memory-context";
import { PROJECT_X_PERSONALITY } from "@/lib/ai/personality";
import type {
  ActionProposal,
  AiMessage,
  ChatAction,
  JourneySuggestion,
} from "@/lib/ai/provider";
import { assembleConversationContext, formatConversationSummary } from "@/lib/chat/summary";
import {
  ACTION_MARKER,
  DEFAULT_CONVERSATION_TITLE,
  MAX_MESSAGE_LENGTH,
} from "@/lib/chat/types";
import { createMemory, getMemoryForUpdate } from "@/lib/memories/service";
import { computeRequiresConfirmation } from "@/lib/memories/types";
import { createClient } from "@/lib/supabase/server";
import type { Journey, Memory } from "@/lib/supabase/types";

// Anthropic SDK + Supabase cookies require the Node runtime; never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TITLE_MAX = 80;

function errorResponse(
  status: number,
  message: string,
  conversationId?: string,
): NextResponse {
  const res = NextResponse.json({ error: message }, { status });
  // Once a conversation exists, surface its id even on errors so the client can
  // Retry (regenerate) the persisted user message instead of re-sending it.
  if (conversationId) {
    res.headers.set("X-Conversation-Id", conversationId);
  }
  return res;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && /abort/i.test(error.name);
}

function deriveTitle(content: string): string {
  const title = content.trim().replace(/\s+/g, " ").slice(0, TITLE_MAX).trim();
  return title.length > 0 ? title : DEFAULT_CONVERSATION_TITLE;
}

/** Enriches a model-proposed suggestion with server-known facts (never taken
 *  from model input): the journey it targets and its current field value. */
function buildJourneySuggestion(
  proposal: Extract<ActionProposal, { kind: "journey_update" }>,
  journey: Journey,
): JourneySuggestion {
  return {
    kind: "journey_update",
    journeyId: journey.id,
    field: proposal.field,
    oldValue: journey[proposal.field],
    suggestedValue: proposal.suggestedValue,
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient();

  // 1. Authenticate (getUser, not getSession).
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return errorResponse(401, "You must be signed in.");
  }

  // 2. Parse + validate the request body. Role is never taken from the client —
  //    an incoming message is always persisted as role "user".
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Invalid request body.");
  }

  const rawContent = (body as { content?: unknown }).content;
  const rawConversationId = (body as { conversationId?: unknown })
    .conversationId;

  let content: string | null = null;
  if (rawContent !== undefined) {
    if (typeof rawContent !== "string") {
      return errorResponse(400, "Invalid message.");
    }
    content = rawContent.trim();
    if (content.length === 0) {
      return errorResponse(400, "Message cannot be empty.");
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return errorResponse(
        400,
        `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      );
    }
  }

  let conversationId: string | null = null;
  if (rawConversationId !== undefined && rawConversationId !== null) {
    if (typeof rawConversationId !== "string" || !UUID_RE.test(rawConversationId)) {
      return errorResponse(400, "Invalid conversation.");
    }
    conversationId = rawConversationId;
  }

  // Two modes: "send" (new user message) or "regenerate" (respond to the
  // existing last user message, e.g. after a failed attempt — no re-insert).
  const mode: "send" | "regenerate" = content !== null ? "send" : "regenerate";
  if (mode === "regenerate" && conversationId === null) {
    return errorResponse(400, "Nothing to respond to.");
  }

  // 3. Resolve the conversation, always verifying ownership server-side — never
  //    trust the client-supplied id alone (RLS is a second line of defense).
  let convId: string;
  let conversationSummary: string | null;
  let conversationSummarizedCount: number;
  if (conversationId !== null) {
    const { data: convo, error } = await supabase
      .from("conversations")
      .select("id, title, summary, summarized_message_count")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("chat: conversation lookup failed:", error);
      return errorResponse(500, "Something went wrong. Please try again.");
    }
    if (!convo) {
      return errorResponse(404, "Conversation not found.");
    }
    convId = convo.id as string;
    conversationSummary = convo.summary as string | null;
    conversationSummarizedCount = convo.summarized_message_count as number;

    // First real message in a still-default conversation → set its title.
    if (
      mode === "send" &&
      content !== null &&
      convo.title === DEFAULT_CONVERSATION_TITLE
    ) {
      await supabase
        .from("conversations")
        .update({ title: deriveTitle(content) })
        .eq("id", convId)
        .eq("user_id", user.id);
    }
  } else {
    // Send mode with no conversation yet → create one owned by the user.
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: deriveTitle(content as string) })
      .select("id, summary, summarized_message_count")
      .single();
    if (error || !created) {
      console.error("chat: conversation create failed:", error);
      return errorResponse(500, "Something went wrong. Please try again.");
    }
    convId = created.id as string;
    conversationSummary = created.summary as string | null;
    conversationSummarizedCount = created.summarized_message_count as number;
  }

  // 4. Persist the user message (send mode only). Done BEFORE loading history so
  //    the loaded window already contains it — we never append it separately.
  if (mode === "send" && content !== null) {
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, role: "user", content });
    if (error) {
      console.error("chat: user message insert failed:", error);
      return errorResponse(500, "Something went wrong. Please try again.");
    }
  }

  // 5. Assemble chat context: the rolling summary plus every message not yet
  //    folded into it — unsummarized overflow (if any), then the recent
  //    window — chronological, nothing dropped. See assembleConversationContext
  //    for how/when the summary itself gets updated.
  const memory = await assembleConversationContext(supabase, {
    id: convId,
    summary: conversationSummary,
    summarized_message_count: conversationSummarizedCount,
  });
  if (memory.messages.length === 0) {
    return errorResponse(400, "Nothing to respond to.");
  }
  const messages: AiMessage[] = memory.messages;

  // 6. System prompt, in order: base personality, Journey context (always
  //    included when the user has an active Journey), Memory context,
  //    conversation summary. Memory retrieval is best-effort: a lookup
  //    failure is logged and degrades to no Memory context for this turn
  //    rather than failing the whole request (unlike Journey/conversation
  //    lookups elsewhere in this route, which do fail the request — Memory
  //    context is enrichment, not something the turn depends on).
  const journey = await retrieveJourneyContext();
  const journeyBlock = formatJourneyContext(journey);

  let memories: Memory[] = [];
  try {
    memories = await retrieveMemoryContext();
  } catch (error) {
    console.error("chat: memory context retrieval failed:", error);
  }
  const memoryBlock = formatMemoryContext(memories);

  const summaryBlock = formatConversationSummary(memory.summary);
  const system = [PROJECT_X_PERSONALITY, journeyBlock, memoryBlock, summaryBlock]
    .filter((part) => part.length > 0)
    .join("\n\n");

  // 7. Peek the first chunk BEFORE committing to a 200 stream, so a provider
  //    failure (or empty completion) before any text becomes a proper HTTP
  //    status instead of a broken stream. The user message is already saved, so
  //    the client can retry (regenerate) cleanly.
  const chatStream = getChatProvider().streamChat({
    system,
    messages,
    signal: request.signal,
    allowJourneySuggestion: journey !== null,
  });

  let iterator: AsyncIterator<string>;
  let first: IteratorResult<string>;
  try {
    iterator = chatStream.text[Symbol.asyncIterator]();
    first = await iterator.next();
  } catch (error) {
    if (isAbortError(error) || request.signal.aborted) {
      const res = new Response(null, { status: 499 });
      res.headers.set("X-Conversation-Id", convId);
      return res;
    }
    console.error("chat: provider failed:", error);
    return errorResponse(
      502,
      "The assistant is unavailable right now. Please try again.",
      convId,
    );
  }
  if (first.done && !first.value) {
    // A reply consisting ONLY of tool calls with no text is a legitimate,
    // successful model turn (e.g. a short stated fact often gets logged via
    // save_memory with nothing else to say) — not a provider failure. `first`
    // being done here means the generator already ran to completion, so
    // chatStream.actions is already resolved; only treat this as unavailable
    // when the reply truly has nothing in it: no text AND no actions.
    const proposalsOnEmptyText = await chatStream.actions;
    if (proposalsOnEmptyText.length === 0) {
      console.error("chat: provider returned no content");
      return errorResponse(
        502,
        "The assistant is unavailable right now. Please try again.",
        convId,
      );
    }
  }

  // 8. Stream the reply. Persist the assistant message ONLY when the stream
  //    completes successfully AND produced non-empty text. Partial text from a
  //    provider error or client abort is streamed to the UI but never saved as
  //    history — a mid-stream failure or abort leaves no assistant row.
  const encoder = new TextEncoder();
  let full = "";
  let completedSuccessfully = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (first.value) {
          full += first.value;
          controller.enqueue(encoder.encode(first.value));
        }
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          full += next.value;
          controller.enqueue(encoder.encode(next.value));
        }
        completedSuccessfully = true;

        // Structured actions: sent as a trailing out-of-band chunk, never
        // mixed into `full` — they must never reach message persistence.
        // Processed in the same order the provider returned them, which is
        // already capped there (KIND_CAPS in anthropic.ts: at most 1
        // journey_update, 3 memory_save, 1 memory_update, 5 total) — this
        // loop preserves that order and those caps rather than re-deriving
        // them.
        const proposals = await chatStream.actions;
        const actions: ChatAction[] = [];
        for (const proposal of proposals) {
          if (proposal.kind === "journey_update") {
            if (journey) {
              actions.push(buildJourneySuggestion(proposal, journey));
            }
            continue;
          }

          if (proposal.kind === "memory_save") {
            // The model's `sensitive` flag is one input, never the final
            // word — the server recomputes the actual policy from
            // origin + sensitive + type (see computeRequiresConfirmation).
            const requiresConfirmation = computeRequiresConfirmation(
              proposal.origin,
              proposal.sensitive,
              proposal.type,
            );
            if (requiresConfirmation) {
              actions.push({
                kind: "memory_save_confirm",
                type: proposal.type,
                content: proposal.content,
                origin: proposal.origin,
                sensitive: proposal.sensitive,
              });
              continue;
            }

            // createMemory throws rather than returning null on failure —
            // caught here so a failed automatic save skips only this one
            // action. Never fail the chat turn over a side-effect that
            // already streamed successfully to the user.
            try {
              const saved = await createMemory(supabase, user.id, {
                type: proposal.type,
                content: proposal.content,
                origin: proposal.origin,
                conversationId: convId,
              });
              actions.push({
                kind: "memory_saved",
                memoryId: saved.id,
                type: saved.type,
                content: saved.content,
              });
            } catch (error) {
              console.error("chat: automatic memory save failed, skipping action:", error);
            }
            continue;
          }

          // memory_update: always requires confirmation, never applied here.
          // Fetch the target fresh from the DB — never trust the model's
          // implicit idea of the current content — scoped to this user. A
          // missing or foreign id (stale context, or a model-invented id) is
          // dropped silently rather than surfaced as an error.
          const target = await getMemoryForUpdate(supabase, user.id, proposal.memoryId);
          if (!target) continue;

          actions.push({
            kind: "memory_update_confirm",
            memoryId: target.id,
            type: target.type,
            oldContent: target.content,
            newContent: proposal.newContent,
            origin: proposal.origin,
          });
        }

        if (actions.length > 0) {
          controller.enqueue(
            encoder.encode(ACTION_MARKER + JSON.stringify(actions)),
          );
        }
      } catch (error) {
        if (!isAbortError(error) && !request.signal.aborted) {
          console.error("chat: stream error:", error);
        }
        // Provider error or client abort: completedSuccessfully stays false, so
        // the partial text already streamed to the UI is never saved as history.
      } finally {
        if (completedSuccessfully && full.trim().length > 0) {
          const { error } = await supabase
            .from("messages")
            .insert({ conversation_id: convId, role: "assistant", content: full });
          if (error) {
            console.error("chat: assistant message insert failed:", error);
          }
        }
        controller.close();
      }
    },
    cancel() {
      void iterator.return?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": convId,
    },
  });
}
