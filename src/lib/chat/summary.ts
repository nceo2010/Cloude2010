import type { SupabaseClient } from "@supabase/supabase-js";

import { getChatProvider } from "@/lib/ai/anthropic";
import type { AiMessage } from "@/lib/ai/provider";
import {
  CONTEXT_WINDOW_SIZE,
  MAX_SUMMARY_LENGTH,
  SUMMARY_BATCH_SIZE,
} from "@/lib/chat/types";
import type { ChatRole } from "@/lib/supabase/types";

/**
 * Conversation memory — the M5 seam described in journey-context.ts, applied
 * to chat history: older messages are folded into a rolling summary instead
 * of falling out of context once they age past CONTEXT_WINDOW_SIZE.
 */

type MessageRow = { role: ChatRole; content: string };

/** The subset of a `conversations` row this module needs. */
export type ConversationMemoryState = {
  id: string;
  summary: string | null;
  summarized_message_count: number;
};

export type ConversationContext = {
  /** Current rolling summary, or null if this conversation has none yet. */
  summary: string | null;
  /**
   * Every message not represented by the summary, oldest first: unsummarized
   * overflow (if a fold is pending or failed) followed by the recent window.
   * Always safe to send to the model verbatim — nothing here is ever dropped.
   */
  messages: AiMessage[];
};

/** Fetches the most recent `limit` messages for a conversation, oldest first. */
async function fetchRecentMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number,
): Promise<MessageRow[]> {
  if (limit <= 0) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("role, content, created_at, id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("conversation summary: message fetch failed:", error);
    return [];
  }
  return ((data as MessageRow[] | null) ?? []).slice().reverse();
}

/**
 * Attempts to fold `pending` un-summarized overflow messages into the rolling
 * summary. Best-effort: any failure (provider error, empty/invalid output, or
 * a concurrent update winning the race) leaves the conversation's stored
 * summary and `summarized_message_count` untouched, and the caller falls back
 * to including those messages verbatim — nothing is ever silently dropped.
 *
 * Returns the resulting { summary, summarized_message_count }, i.e. the
 * updated values on success or the original `conversation` values otherwise.
 */
async function tryFoldOverflow(
  supabase: SupabaseClient,
  conversation: ConversationMemoryState,
  overflow: number,
  pending: number,
): Promise<{ summary: string | null; summarizedMessageCount: number }> {
  const fallback = {
    summary: conversation.summary,
    summarizedMessageCount: conversation.summarized_message_count,
  };

  const { data, error: fetchError } = await supabase
    .from("messages")
    .select("role, content, created_at, id")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(
      conversation.summarized_message_count,
      conversation.summarized_message_count + pending - 1,
    );
  if (fetchError) {
    console.error("conversation summary: fold batch fetch failed:", fetchError);
    return fallback;
  }
  const batch = (data as MessageRow[] | null) ?? [];
  if (batch.length === 0) return fallback;

  let folded: string;
  try {
    folded = await getChatProvider().summarize({
      priorSummary: conversation.summary,
      messages: batch.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (error) {
    console.error("conversation summary: summarize call failed:", error);
    return fallback;
  }

  const trimmed = folded.trim();
  if (trimmed.length === 0) {
    console.error("conversation summary: summarize returned empty output");
    return fallback;
  }
  const enforced = trimmed.slice(0, MAX_SUMMARY_LENGTH);

  const { data: updated, error: updateError } = await supabase
    .from("conversations")
    .update({
      summary: enforced,
      summarized_message_count: overflow,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id)
    .eq("summarized_message_count", conversation.summarized_message_count)
    .select("id")
    .maybeSingle();
  if (updateError) {
    console.error("conversation summary: update failed:", updateError);
    return fallback;
  }
  if (!updated) {
    // No row matched — summarized_message_count moved under us (concurrent
    // fold). Treat as a skip; the next request will re-attempt from fresh state.
    return fallback;
  }

  return { summary: enforced, summarizedMessageCount: overflow };
}

/**
 * Assembles the full chat context for a conversation: the rolling summary
 * plus every message not yet folded into it (unsummarized overflow, oldest
 * first, followed by the recent window), ordered by created_at then id.
 *
 * When at least SUMMARY_BATCH_SIZE overflow messages have accumulated since
 * the last fold, attempts to fold them in first so the unsummarized segment
 * stays bounded below SUMMARY_BATCH_SIZE. A failed or skipped fold never
 * drops messages — they simply remain in the verbatim segment.
 */
export async function assembleConversationContext(
  supabase: SupabaseClient,
  conversation: ConversationMemoryState,
): Promise<ConversationContext> {
  const { count, error: countError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation.id);
  if (countError) {
    console.error("conversation summary: count failed:", countError);
    // Fall back to a plain recency window — same behavior as before M5.2.
    const recent = await fetchRecentMessages(
      supabase,
      conversation.id,
      CONTEXT_WINDOW_SIZE,
    );
    return {
      summary: conversation.summary,
      messages: recent.map((m) => ({ role: m.role, content: m.content })),
    };
  }

  const totalCount = count ?? 0;
  const overflow = Math.max(0, totalCount - CONTEXT_WINDOW_SIZE);
  const pending = overflow - conversation.summarized_message_count;

  let summary = conversation.summary;
  let summarizedMessageCount = conversation.summarized_message_count;
  if (pending >= SUMMARY_BATCH_SIZE) {
    const result = await tryFoldOverflow(
      supabase,
      conversation,
      overflow,
      pending,
    );
    summary = result.summary;
    summarizedMessageCount = result.summarizedMessageCount;
  }

  const remaining = totalCount - summarizedMessageCount;
  const rows = await fetchRecentMessages(supabase, conversation.id, remaining);

  return {
    summary,
    messages: rows.map((m) => ({ role: m.role, content: m.content })),
  };
}

/**
 * Formats the rolling summary into a system-prompt block, or an empty string
 * when there is none. Mirrors formatJourneyContext's shape/placement.
 */
export function formatConversationSummary(summary: string | null): string {
  if (!summary) return "";
  return `Summary of earlier parts of this conversation (older messages, already condensed):
${summary}

Treat this as background context for continuity, not something to repeat back to the user unprompted.`;
}
