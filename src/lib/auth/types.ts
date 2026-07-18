/** State returned by the magic-link server action, consumed via useActionState. */
export type MagicLinkState = {
  status: "idle" | "error" | "success";
  message: string | null;
};
