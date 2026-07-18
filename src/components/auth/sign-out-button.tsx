"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

function SignOutSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

/** Sign-out control backed by a server action. */
export function SignOutButton() {
  return (
    <form action={signOut} className="w-full">
      <SignOutSubmit />
    </form>
  );
}
