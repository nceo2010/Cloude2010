"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpWithPassword } from "@/lib/auth/actions";
import type { PasswordAuthState } from "@/lib/auth/types";

const initialState: PasswordAuthState = { status: "idle", message: null };

/**
 * Email + password registration form. Validation errors and the
 * email-confirmation notice are returned by the server action and rendered
 * inline. On an immediate session the action redirects away from this page.
 */
export function PasswordRegisterForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(
    signUpWithPassword,
    initialState,
  );

  const done = state.status === "success";

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

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
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={pending || done}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          required
          disabled={pending || done}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-confirm-password">Confirm password</Label>
        <Input
          id="register-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          minLength={8}
          required
          disabled={pending || done}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending || done}>
        {pending ? "Creating account…" : done ? "Account created" : "Sign up with email"}
      </Button>
    </form>
  );
}
