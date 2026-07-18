import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthPath, isProtectedPath, routes } from "@/lib/routes";

/**
 * Refreshes the Supabase auth session on each request, keeps the auth cookies
 * in sync between request and response, and enforces route protection:
 *
 *  - Unauthenticated users hitting a protected route are sent to /login
 *    (with a `redirectTo` so they can return after signing in).
 *  - Authenticated users hitting an auth route (/login, /register) are sent
 *    to the dashboard.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() refreshes the token and must run before any
  // redirect so the refreshed cookies are carried onto the redirect response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Not signed in and trying to reach a protected route → go to login.
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = routes.login;
    url.searchParams.set("redirectTo", pathname);
    return copyCookies(response, NextResponse.redirect(url));
  }

  // Already signed in and trying to reach an auth route → go to dashboard.
  if (user && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = routes.dashboard;
    url.search = "";
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

/** Carry the session cookies set on `from` onto a new `to` response. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}
