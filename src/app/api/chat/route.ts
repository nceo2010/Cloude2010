import { NextResponse, type NextRequest } from "next/server";

import { getChatProvider } from "@/lib/ai/anthropic";
import { formatGoalContext, retrieveRelevantGoals } from "@/lib/ai/goal-context";
import { PROJECT_X_PERSONALITY } from "@/lib/ai/personality";
import type { AiMessage } from "@/lib/ai/provider";
import {
  CONTEXT_WINDOW_SIZE,
  DEFAULT_CONVERSATION_TITLE,
  MAX_MESSAGE_LENGTH,
} from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/server";
import type { ChatRole } from "@/lib/supabase/types";

// Anthropic SDK + Supabase cookies require the Node runtime; never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TITLE_MAX = 80;

type HistoryRow = { role: ChatRole; content: string };

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
  if (rawConversationId !== undefined) {
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
  if (conversationId !== null) {
    const { data: convo, error } = await supabase
      .from("conversations")
      .select("id, title")
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
      .select("id")
      .single();
    if (error || !created) {
      console.error("chat: conversation create failed:", error);
      return errorResponse(500, "Something went wrong. Please try again.");
    }
    convId = created.id as string;
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

  // 5. Load the most recent CONTEXT_WINDOW_SIZE messages, then reverse to
  //    chronological order for the model.
  const { data: recent, error: historyError } = await supabase
    .from("messages")
    .select("role, content, created_at, id")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CONTEXT_WINDOW_SIZE);
  if (historyError) {
    console.error("chat: history load failed:", historyError);
    return errorResponse(500, "Something went wrong. Please try again.");
  }

  const ordered = ((recent as HistoryRow[] | null) ?? []).slice().reverse();
  if (ordered.length === 0) {
    return errorResponse(400, "Nothing to respond to.");
  }
  const messages: AiMessage[] = ordered.map((row) => ({
    role: row.role,
    content: row.content,
  }));

  // 6. Contextual goal retrieval keyed on the latest user message.
  const lastUser = ordered.filter((row) => row.role === "user").at(-1);
  const relevantGoals = await retrieveRelevantGoals(lastUser?.content ?? "");
  const goalBlock = formatGoalContext(relevantGoals);
  const system = [PROJECT_X_PERSONALITY, goalBlock]
    .filter((part) => part.length > 0)
    .join("\n\n");

  // 7. Peek the first chunk BEFORE committing to a 200 stream, so a provider
  //    failure (or empty completion) before any text becomes a proper HTTP
  //    status instead of a broken stream. The user message is already saved, so
  //    the client can retry (regenerate) cleanly.
  let iterator: AsyncIterator<string>;
  let first: IteratorResult<string>;
  try {
    iterator = getChatProvider()
      .streamChat({ system, messages, signal: request.signal })
      [Symbol.asyncIterator]();
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
    console.error("chat: provider returned no content");
    return errorResponse(
      502,
      "The assistant is unavailable right now. Please try again.",
      convId,
    );
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
