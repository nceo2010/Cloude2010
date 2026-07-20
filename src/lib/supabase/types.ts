/** Shape of a row in the `profiles` table. */
export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

/** Lifecycle status of a goal. */
export type GoalStatus = "active" | "completed";

/** Shape of a row in the `goals` table. */
export type Goal = {
  id: string;
  user_id: string;
  title: string;
  status: GoalStatus;
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
