"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithMagicLink } from "@/lib/auth/actions";
import type { MagicLinkState } from "@/lib/auth/types";

const initialState: MagicLinkState = { status: "idle", message: null };

/** Email → magic-link form with inline loading, error, and success states. */
export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState(
    signInWithMagicLink,
    initialState,
  );

  const done = state.status === "success";

  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {done && state.message ? (
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={pending || done}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending || done}>
        {pending ? "Sending…" : done ? "Link sent" : "Send magic link"}
      </Button>
    </form>
  );
}
