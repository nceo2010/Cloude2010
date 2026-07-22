"use server";

import { revalidatePath } from "next/cache";

import {
  isJourneySuggestionField,
  type JourneyFormState,
  type JourneySuggestionField,
} from "@/lib/journeys/types";
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

/** Validate a suggestion field name from the form against the fixed allowlist. */
function parseSuggestionField(
  formData: FormData,
): { field: JourneySuggestionField } | JourneyFormState {
  const raw = formData.get("field");
  if (typeof raw !== "string" || !isJourneySuggestionField(raw)) {
    return {
      status: "error",
      message: "Invalid suggestion field.",
      journeyId: null,
    };
  }
  return { field: raw };
}

/**
 * Parse the snapshotted "old value" a suggestion was made against. The client
 * JSON-encodes it so null / number / string round-trip exactly through the
 * hidden form field.
 */
function parseSuggestionOldValue(
  formData: FormData,
): { value: string | number | null } | JourneyFormState {
  const raw = formData.get("oldValue");
  const invalid: JourneyFormState = {
    status: "error",
    message: "Invalid suggestion reference.",
    journeyId: null,
  };
  if (typeof raw !== "string") return invalid;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed === "string" || typeof parsed === "number") {
      return { value: parsed };
    }
  } catch {
    // fall through to invalid
  }
  return invalid;
}

/**
 * Accept a single-field Journey Memory Suggestion proposed by the AI in chat.
 * Applies ONLY when the field's live value still matches the snapshotted
 * `oldValue` the suggestion was made against — checked atomically as part of
 * the update's WHERE clause, so a concurrent edit (e.g. from the dashboard)
 * rejects the update instead of silently overwriting newer data. Nothing is
 * ever applied automatically; this only runs when the user explicitly submits.
 */
export async function applyJourneySuggestion(
  _prevState: JourneyFormState,
  formData: FormData,
): Promise<JourneyFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) return fail("applyJourneySuggestion auth check failed", authError);
  if (!user) return notSignedIn;

  const idParsed = parseJourneyId(formData);
  if ("status" in idParsed) return idParsed;

  const fieldParsed = parseSuggestionField(formData);
  if ("status" in fieldParsed) return fieldParsed;

  const oldValueParsed = parseSuggestionOldValue(formData);
  if ("status" in oldValueParsed) return oldValueParsed;

  const rawSuggested = formData.get("suggestedValue");
  if (typeof rawSuggested !== "string") {
    return {
      status: "error",
      message: "Invalid suggested value.",
      journeyId: null,
    };
  }

  const { field } = fieldParsed;
  const { value: oldValue } = oldValueParsed;

  let newValue: string | number;
  if (field === "progress_percentage") {
    const numeric = Number(rawSuggested.trim());
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
      return {
        status: "error",
        message: "Progress must be a whole number between 0 and 100.",
        journeyId: null,
      };
    }
    newValue = numeric;
  } else {
    const trimmed = rawSuggested.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_FIELD_LENGTH) {
      return {
        status: "error",
        message: `Suggested value must be ${MAX_TEXT_FIELD_LENGTH} characters or fewer.`,
        journeyId: null,
      };
    }
    newValue = trimmed;
  }

  let query = supabase
    .from("journeys")
    .update({ [field]: newValue, updated_at: new Date().toISOString() })
    .eq("id", idParsed.id)
    .eq("user_id", user.id)
    .eq("status", "active");
  query = oldValue === null ? query.is(field, null) : query.eq(field, oldValue);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) return fail("applyJourneySuggestion update failed", error);
  if (!data) {
    return {
      status: "error",
      message:
        "This journey has changed since the suggestion was made — please review its current values.",
      journeyId: null,
    };
  }

  revalidatePath(routes.dashboard);
  return { status: "success", message: null, journeyId: data.id };
}
