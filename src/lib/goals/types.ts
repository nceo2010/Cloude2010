/**
 * State returned by the goal mutation actions, consumed via useActionState.
 * On success `goalId` carries the id of the affected row so the UI can
 * distinguish a real mutation from "no matching active goal".
 */
export type GoalFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  goalId: string | null;
};
