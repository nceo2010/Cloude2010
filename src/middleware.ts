import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root middleware.
 *
 * Note: Next.js 16 renamed Middleware to "Proxy" (`proxy.ts`), but the
 * `middleware.ts` convention is still supported. It is kept here to match the
 * project's M0 plan and the standard Supabase SSR setup.
 *
 * For now it only refreshes the Supabase session on every matched request.
 * Route protection / redirects will be added in a later milestone.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
