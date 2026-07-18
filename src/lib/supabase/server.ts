import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions. `cookies()` is async in Next.js 16, so this helper is async too.
 *
 * The cookie `set` calls are wrapped in try/catch because Server Components
 * cannot mutate cookies — in that context session refresh is handled by the
 * proxy/middleware layer instead (see `lib/supabase/middleware.ts`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because the
            // middleware layer refreshes the session cookies.
          }
        },
      },
    },
  );
}
