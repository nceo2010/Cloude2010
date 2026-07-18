"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { MagicLinkState } from "@/lib/auth/types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Resolve the request origin so redirect URLs work in any environment. */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Send a passwordless magic link to the provided email.
 * Used with `useActionState`; returns a status the form can render.
 */
export async function signInWithMagicLink(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback?next=${routes.dashboard}`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Check your email for a magic link to sign in.",
  };
}

/** Begin the Google OAuth flow by redirecting to the provider consent screen. */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${routes.dashboard}`,
    },
  });

  if (error) {
    redirect(`${routes.login}?error=${encodeURIComponent(error.message)}`);
  }

  if (data?.url) {
    redirect(data.url);
  }

  redirect(
    `${routes.login}?error=${encodeURIComponent("Could not start Google sign-in.")}`,
  );
}

/** Sign the current user out and return them to the login page. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(routes.login);
}
