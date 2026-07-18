"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { MagicLinkState, PasswordAuthState } from "@/lib/auth/types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Constrain post-auth redirects to internal paths so a crafted `redirectTo`
 * value can't turn sign-in into an open redirect.
 */
function safeRedirect(target: string): string {
  return target.startsWith("/") && !target.startsWith("//")
    ? target
    : routes.dashboard;
}

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

/**
 * Register a new account with email + password.
 *
 * If the Supabase project requires email confirmation, no session is issued
 * and we return a "check your email" status. Otherwise a session is created
 * immediately (cookies are set by the server client) and we redirect into the
 * app. Used with `useActionState`.
 */
export async function signUpWithPassword(
  _prevState: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const next = safeRedirect(String(formData.get("redirectTo") ?? ""));

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "Passwords do not match." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${next}`,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // No session → the project requires email confirmation before first sign-in.
  if (!data.session) {
    return {
      status: "success",
      message: "Check your email to confirm your account, then log in.",
    };
  }

  // Session issued immediately — redirect must be outside any try/catch.
  redirect(next);
}

/**
 * Sign in with email + password. On success the server client stores the
 * session cookies and we redirect into the app; on failure we return an error
 * status for the form. Used with `useActionState`.
 */
export async function signInWithPassword(
  _prevState: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirect(String(formData.get("redirectTo") ?? ""));

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  if (!password) {
    return { status: "error", message: "Please enter your password." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: error.message };
  }

  redirect(next);
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
