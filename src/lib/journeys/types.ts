/**
 * State returned by the journey mutation actions, consumed via useActionState.
 * On success `journeyId` carries the id of the affected row so the UI can
 * distinguish a real mutation from "no matching active journey".
 */
export type JourneyFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  journeyId: string | null;
};
