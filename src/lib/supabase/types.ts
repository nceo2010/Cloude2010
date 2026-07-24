import type { MemoryOrigin, MemoryType } from "@/lib/memories/types";

/** Shape of a row in the `profiles` table. */
export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Lifecycle status of a journey. */
export type JourneyStatus = "active" | "completed";

/** Shape of a row in the `journeys` table. */
export type Journey = {
  id: string;
  user_id: string;
  title: string;
  goal_description: string | null;
  current_stage: string | null;
  progress_percentage: number | null;
  next_step: string | null;
  status: JourneyStatus;
  created_at: string;
  updated_at: string;
};

/** Role of a chat message. */
export type ChatRole = "user" | "assistant";

/** Shape of a row in the `conversations` table. */
export type Conversation = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  summarized_message_count: number;
  created_at: string;
  updated_at: string;
};

/** Shape of a row in the `messages` table. */
export type Message = {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};

/** Where a memory originated. Always "chat" today — "manual" is reserved for a future manual-entry path. */
export type MemorySource = "chat" | "manual";

/** Shape of a row in the `user_memories` table. */
export type Memory = {
  id: string;
  user_id: string;
  type: MemoryType;
  content: string;
  origin: MemoryOrigin;
  source: MemorySource;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string;
};
