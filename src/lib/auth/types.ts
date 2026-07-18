/** State returned by the magic-link server action, consumed via useActionState. */
export type MagicLinkState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/**
 * State returned by the email/password auth actions, consumed via
 * useActionState. On success these actions redirect instead of returning, so
 * "success" is only used when sign-up requires an email confirmation step.
 */
export type PasswordAuthState = {
  status: "idle" | "error" | "success";
  message: string | null;
};
