"use server";

import { revalidatePath } from "next/cache";

import type { GoalFormState } from "@/lib/goals/types";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 200;
const UNIQUE_VIOLATION = "23505";
const GENERIC_ERROR = "Something went wrong. Please try again.";

const notSignedIn: GoalFormState = {
  status: "error",
  message: "You must be signed in.",
  goalId: null,
};

/** Log the real error server-side; return a generic message to the UI. */
function fail(context: string, error: unknown): GoalFormState {
  console.error(`${context}:`, error);
  return { status: "error", message: GENERIC_ERROR, goalId: null };
}

/** Validate + normalize a submitted title, or return an error state. */
function parseTitle(formData: FormData): { title: string } | GoalFormState {
  const raw = formData.get("title");
  if (typeof raw !== "string") {
    return {
      status: "error",
      message: "Please enter a goal title.",
      goalId: null,
    };
  }
  const title = raw.trim();
  if (!title) {
    return {
      status: "error",
      message: "Please enter a goal title.",
      goalId: null,
    };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      status: "error",
      message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
      goalId: null,
    };
  }
  return { title };
}

/** Validate a goalId from the form as a UUID, or return an error state. */
function parseGoalId(formData: FormData): { id: string } | GoalFormState {
  const raw = formData.get("goalId");
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    return {
      status: "error",
      message: "Invalid goal reference.",
      goalId: null,
    };
  }
  return { id: raw };
}

/** Create a new active goal. Fails if the user already has one (unique index). */
export async function createGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("createGoal auth check failed", authError);
  if (!user) return notSignedIn;

  const parsed = parseTitle(formData);
  if ("status" in parsed) return parsed;

  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: user.id, title: parsed.title })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        status: "error",
        message:
          "You already have an active goal. Complete it before creating a new one.",
        goalId: null,
      };
    }
    return fail("createGoal insert failed", error);
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, goalId: data.id };
}

/** Edit the title of the user's active goal (scoped by id + user_id + status). */
export async function updateGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("updateGoal auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseGoalId(formData);
  if ("status" in idParsed) return idParsed;

  const parsed = parseTitle(formData);
  if ("status" in parsed) return parsed;

  const { data, error } = await supabase
    .from("goals")
    .update({ title: parsed.title, updated_at: new Date().toISOString() })
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) return fail("updateGoal failed", error);
  if (!data) {
    return {
      status: "error",
      message: "No matching active goal to update.",
      goalId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, goalId: data.id };
}

/** Mark the user's active goal completed, freeing the active slot. */
export async function completeGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("completeGoal auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseGoalId(formData);
  if ("status" in idParsed) return idParsed;

  const { data, error } = await supabase
    .from("goals")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) return fail("completeGoal failed", error);
  if (!data) {
    return {
      status: "error",
      message: "No matching active goal to complete.",
      goalId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, goalId: data.id };
}

/** Delete the user's active goal (scoped by id + user_id + status). */
export async function deleteGoal(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("deleteGoal auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseGoalId(formData);
  if ("status" in idParsed) return idParsed;

  const { data, error } = await supabase
    .from("goals")
    .delete()
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) return fail("deleteGoal failed", error);
  if (!data) {
    return {
      status: "error",
      message: "No matching active goal to delete.",
      goalId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, goalId: data.id };
}
