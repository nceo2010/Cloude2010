import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * App-level guarantee that a profile row exists for the given user.
 *
 * Called from the auth callback right after a successful sign-in, so a
 * profile is created on first login and kept in sync on subsequent logins.
 * This complements the DB trigger in `supabase/migrations/0001_profiles.sql`
 * and works even if that trigger has not been installed.
 */
export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const metadata = user.user_metadata ?? {};
  const fullName =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    null;
  const avatarUrl = (metadata.avatar_url as string | undefined) ?? null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    // Don't block sign-in on a profile write failure — surface it in logs.
    console.error("ensureProfile failed:", error.message);
  }

  return error;
}
