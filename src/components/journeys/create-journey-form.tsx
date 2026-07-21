"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createJourney } from "@/lib/journeys/actions";
import type { JourneyFormState } from "@/lib/journeys/types";

const initialState: JourneyFormState = {
  status: "idle",
  message: null,
  journeyId: null,
};

/**
 * Create the user's single active journey. On success `createJourney`
 * revalidates the dashboard, which re-renders and replaces this form with
 * the journey card.
 */
export function CreateJourneyForm() {
  const [state, formAction, pending] = useActionState(
    createJourney,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="create-journey-title">Journey title</Label>
        <Input
          id="create-journey-title"
          name="title"
          type="text"
          placeholder="What do you want to achieve?"
          maxLength={200}
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-journey-description">
          Description (optional)
        </Label>
        <Input
          id="create-journey-description"
          name="goalDescription"
          type="text"
          placeholder="What does this journey involve?"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-journey-stage">Current stage (optional)</Label>
        <Input
          id="create-journey-stage"
          name="currentStage"
          type="text"
          placeholder="Where are you right now?"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-journey-next-step">Next step (optional)</Label>
        <Input
          id="create-journey-next-step"
          name="nextStep"
          type="text"
          placeholder="What's the next concrete step?"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-journey-progress">
          Progress % (optional)
        </Label>
        <Input
          id="create-journey-progress"
          name="progressPercentage"
          type="number"
          min={0}
          max={100}
          placeholder="0"
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create journey"}
      </Button>
    </form>
  );
}
