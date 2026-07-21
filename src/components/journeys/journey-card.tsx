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
import {
  completeJourney,
  deleteJourney,
  updateJourney,
} from "@/lib/journeys/actions";
import type { JourneyFormState } from "@/lib/journeys/types";
import type { Journey } from "@/lib/supabase/types";

const initialState: JourneyFormState = {
  status: "idle",
  message: null,
  journeyId: null,
};

/**
 * The user's active journey: edit its fields, mark it complete, or delete it.
 * Each control is its own form with its own useActionState, so only the
 * pending action's controls are disabled. Fields are uncontrolled inputs
 * seeded from props — no journey data is mirrored in client state. All
 * actions revalidate the dashboard, which re-renders this card from the server.
 */
export function JourneyCard({ journey }: { journey: Journey }) {
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateJourney,
    initialState,
  );
  const [completeState, completeFormAction, completePending] = useActionState(
    completeJourney,
    initialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteJourney,
    initialState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your active journey</CardTitle>
      </CardHeader>

      <CardContent>
        <form action={updateFormAction} className="space-y-4">
          <input type="hidden" name="journeyId" value={journey.id} />

          <div className="space-y-2">
            <Label htmlFor="edit-journey-title">Journey title</Label>
            <Input
              id="edit-journey-title"
              name="title"
              type="text"
              defaultValue={journey.title}
              maxLength={200}
              required
              disabled={updatePending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-journey-description">Description</Label>
            <Input
              id="edit-journey-description"
              name="goalDescription"
              type="text"
              defaultValue={journey.goal_description ?? ""}
              disabled={updatePending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-journey-stage">Current stage</Label>
            <Input
              id="edit-journey-stage"
              name="currentStage"
              type="text"
              defaultValue={journey.current_stage ?? ""}
              disabled={updatePending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-journey-next-step">Next step</Label>
            <Input
              id="edit-journey-next-step"
              name="nextStep"
              type="text"
              defaultValue={journey.next_step ?? ""}
              disabled={updatePending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-journey-progress">Progress %</Label>
            <Input
              id="edit-journey-progress"
              name="progressPercentage"
              type="number"
              min={0}
              max={100}
              defaultValue={journey.progress_percentage ?? ""}
              disabled={updatePending}
            />
          </div>

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
            <input type="hidden" name="journeyId" value={journey.id} />
            <Button type="submit" disabled={completePending}>
              {completePending ? "Completing…" : "Complete"}
            </Button>
          </form>

          <form action={deleteFormAction}>
            <input type="hidden" name="journeyId" value={journey.id} />
            <Button type="submit" variant="destructive" disabled={deletePending}>
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
          </form>
        </div>
      </CardFooter>
    </Card>
  );
}
