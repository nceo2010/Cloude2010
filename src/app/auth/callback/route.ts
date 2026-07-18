import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { ensureProfile } from "@/lib/profile";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback. Handles both:
 *  - OAuth / PKCE  → `?code=...`        → exchangeCodeForSession
 *  - Email OTP     → `?token_hash&type` → verifyOtp
 *
 * On success it ensures a profile exists, then redirects to `next`
 * (defaults to the dashboard). On failure it redirects back to /login
 * with a human-readable error message.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? routes.dashboard;

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const loginWithError = (message: string) =>
    NextResponse.redirect(
      `${origin}${routes.login}?error=${encodeURIComponent(message)}`,
    );

  if (providerError) {
    return loginWithError(providerError);
  }

  const supabase = await createClient();

  let authError: { message: string } | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    authError = error;
  } else {
    return loginWithError("Invalid or expired authentication link.");
  }

  if (authError) {
    return loginWithError(authError.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await ensureProfile(supabase, user);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
