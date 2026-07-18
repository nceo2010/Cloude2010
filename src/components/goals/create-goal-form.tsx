"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGoal } from "@/lib/goals/actions";
import type { GoalFormState } from "@/lib/goals/types";

const initialState: GoalFormState = {
  status: "idle",
  message: null,
  goalId: null,
};

/**
 * Create the user's single active goal. On success `createGoal` revalidates
 * the dashboard, which re-renders and replaces this form with the goal card.
 */
export function CreateGoalForm() {
  const [state, formAction, pending] = useActionState(createGoal, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="create-goal-title">Goal title</Label>
        <Input
          id="create-goal-title"
          name="title"
          type="text"
          placeholder="What do you want to achieve?"
          maxLength={200}
          required
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create goal"}
      </Button>
    </form>
  );
}
