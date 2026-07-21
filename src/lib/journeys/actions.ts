"use server";

import { revalidatePath } from "next/cache";

import type { JourneyFormState } from "@/lib/journeys/types";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_FIELD_LENGTH = 2000;
const UNIQUE_VIOLATION = "23505";
const GENERIC_ERROR = "Something went wrong. Please try again.";

const notSignedIn: JourneyFormState = {
  status: "error",
  message: "You must be signed in.",
  journeyId: null,
};

/** Log the real error server-side; return a generic message to the UI. */
function fail(context: string, error: unknown): JourneyFormState {
  console.error(`${context}:`, error);
  return { status: "error", message: GENERIC_ERROR, journeyId: null };
}

/** Validate + normalize a submitted title, or return an error state. */
function parseTitle(formData: FormData): { title: string } | JourneyFormState {
  const raw = formData.get("title");
  if (typeof raw !== "string") {
    return {
      status: "error",
      message: "Please enter a journey title.",
      journeyId: null,
    };
  }
  const title = raw.trim();
  if (!title) {
    return {
      status: "error",
      message: "Please enter a journey title.",
      journeyId: null,
    };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      status: "error",
      message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`,
      journeyId: null,
    };
  }
  return { title };
}

/** Validate an optional free-text field, or return an error state. */
function parseOptionalText(
  formData: FormData,
  field: string,
  label: string,
): { value: string | null } | JourneyFormState {
  const raw = formData.get(field);
  if (typeof raw !== "string") return { value: null };
  const value = raw.trim();
  if (!value) return { value: null };
  if (value.length > MAX_TEXT_FIELD_LENGTH) {
    return {
      status: "error",
      message: `${label} must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer.`,
      journeyId: null,
    };
  }
  return { value };
}

/** Validate an optional 0-100 progress percentage, or return an error state. */
function parseProgress(
  formData: FormData,
): { value: number | null } | JourneyFormState {
  const raw = formData.get("progressPercentage");
  if (typeof raw !== "string" || raw.trim() === "") return { value: null };
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return {
      status: "error",
      message: "Progress must be a whole number between 0 and 100.",
      journeyId: null,
    };
  }
  return { value };
}

/** Validate a journeyId from the form as a UUID, or return an error state. */
function parseJourneyId(
  formData: FormData,
): { id: string } | JourneyFormState {
  const raw = formData.get("journeyId");
  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    return {
      status: "error",
      message: "Invalid journey reference.",
      journeyId: null,
    };
  }
  return { id: raw };
}

/** Create a new active journey. Fails if the user already has one (unique index). */
export async function createJourney(
  _prevState: JourneyFormState,
  formData: FormData,
): Promise<JourneyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("createJourney auth check failed", authError);
  if (!user) return notSignedIn;

  const title = parseTitle(formData);
  if ("status" in title) return title;

  const goalDescription = parseOptionalText(
    formData,
    "goalDescription",
    "Description",
  );
  if ("status" in goalDescription) return goalDescription;

  const currentStage = parseOptionalText(
    formData,
    "currentStage",
    "Current stage",
  );
  if ("status" in currentStage) return currentStage;

  const nextStep = parseOptionalText(formData, "nextStep", "Next step");
  if ("status" in nextStep) return nextStep;

  const progress = parseProgress(formData);
  if ("status" in progress) return progress;

  const { data, error } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      title: title.title,
      goal_description: goalDescription.value,
      current_stage: currentStage.value,
      next_step: nextStep.value,
      progress_percentage: progress.value,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        status: "error",
        message:
          "You already have an active journey. Complete it before creating a new one.",
        journeyId: null,
      };
    }
    return fail("createJourney insert failed", error);
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, journeyId: data.id };
}

/** Edit the user's active journey (scoped by id + user_id + status). */
export async function updateJourney(
  _prevState: JourneyFormState,
  formData: FormData,
): Promise<JourneyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("updateJourney auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseJourneyId(formData);
  if ("status" in idParsed) return idParsed;

  const title = parseTitle(formData);
  if ("status" in title) return title;

  const goalDescription = parseOptionalText(
    formData,
    "goalDescription",
    "Description",
  );
  if ("status" in goalDescription) return goalDescription;

  const currentStage = parseOptionalText(
    formData,
    "currentStage",
    "Current stage",
  );
  if ("status" in currentStage) return currentStage;

  const nextStep = parseOptionalText(formData, "nextStep", "Next step");
  if ("status" in nextStep) return nextStep;

  const progress = parseProgress(formData);
  if ("status" in progress) return progress;

  const { data, error } = await supabase
    .from("journeys")
    .update({
      title: title.title,
      goal_description: goalDescription.value,
      current_stage: currentStage.value,
      next_step: nextStep.value,
      progress_percentage: progress.value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) return fail("updateJourney failed", error);
  if (!data) {
    return {
      status: "error",
      message: "No matching active journey to update.",
      journeyId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, journeyId: data.id };
}

/** Mark the user's active journey completed, freeing the active slot. */
export async function completeJourney(
  _prevState: JourneyFormState,
  formData: FormData,
): Promise<JourneyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("completeJourney auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseJourneyId(formData);
  if ("status" in idParsed) return idParsed;

  const { data, error } = await supabase
    .from("journeys")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) return fail("completeJourney failed", error);
  if (!data) {
    return {
      status: "error",
      message: "No matching active journey to complete.",
      journeyId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, journeyId: data.id };
}

/** Delete the user's active journey (scoped by id + user_id + status). */
export async function deleteJourney(
  _prevState: JourneyFormState,
  formData: FormData,
): Promise<JourneyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("deleteJourney auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseJourneyId(formData);
  if ("status" in idParsed) return idParsed;

  const { data, error } = await supabase
    .from("journeys")
    .delete()
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) return fail("deleteJourney failed", error);
  if (!data) {
    return {
      status: "error",
      message: "No matching active journey to delete.",
      journeyId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, journeyId: data.id };
}
