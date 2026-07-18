"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeGoal, deleteGoal, updateGoal } from "@/lib/goals/actions";
import type { GoalFormState } from "@/lib/goals/types";
import type { Goal } from "@/lib/supabase/types";

const initialState: GoalFormState = {
  status: "idle",
  message: null,
  goalId: null,
};

/**
 * The user's active goal: edit the title, mark it complete, or delete it.
 * Each control is its own form with its own useActionState, so only the
 * pending action's controls are disabled. The title is an uncontrolled input
 * seeded from props — no goal data is mirrored in client state. All three
 * actions revalidate the dashboard, which re-renders this card from the server.
 */
export function GoalCard({ goal }: { goal: Goal }) {
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateGoal,
    initialState,
  );
  const [completeState, completeFormAction, completePending] = useActionState(
    completeGoal,
    initialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteGoal,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your active goal</CardTitle>
      </CardHeader>

      <CardContent>
        <form action={updateFormAction} className="space-y-2">
          <input type="hidden" name="goalId" value={goal.id} />
          <Label htmlFor="edit-goal-title">Goal title</Label>
          <Input
            id="edit-goal-title"
            name="title"
            type="text"
            defaultValue={goal.title}
            maxLength={200}
            required
            disabled={updatePending}
          />
          {updateState.status === "error" && updateState.message ? (
            <Alert variant="destructive">
              <AlertDescription>{updateState.message}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={updatePending}
          >
            {updatePending ? "Saving…" : "Save"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        {completeState.status === "error" && completeState.message ? (
          <Alert variant="destructive">
            <AlertDescription>{completeState.message}</AlertDescription>
          </Alert>
        ) : null}
        {deleteState.status === "error" && deleteState.message ? (
          <Alert variant="destructive">
            <AlertDescription>{deleteState.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex gap-2">
          <form action={completeFormAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <Button type="submit" disabled={completePending}>
              {completePending ? "Completing…" : "Complete"}
            </Button>
          </form>

          <form action={deleteFormAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <Button type="submit" variant="destructive" disabled={deletePending}>
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
          </form>
        </div>
      </CardFooter>
    </Card>
  );
}
