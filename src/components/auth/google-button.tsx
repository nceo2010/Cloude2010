"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth/actions";

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full"
      disabled={pending}
    >
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}

/** Kicks off Google OAuth via a server action that redirects to the provider. */
export function GoogleButton() {
  return (
    <form action={signInWithGoogle}>
      <GoogleSubmit />
    </form>
  );
}
