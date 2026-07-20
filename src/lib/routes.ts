/**
 * Centralized route definitions.
 *
 * Keep every navigable path in one place so links, redirects, and the
 * proxy/middleware matcher never drift out of sync.
 */

export const routes = {
  // (marketing)
  home: "/",
  about: "/about",
  pricing: "/pricing",

  // (auth)
  login: "/login",
  register: "/register",

  // (app)
  dashboard: "/dashboard",
  chat: "/chat",
  settings: "/settings",
} as const;

export type RouteKey = keyof typeof routes;
export type RoutePath = (typeof routes)[RouteKey];

/** Path prefixes that live behind the authenticated app shell. */
export const protectedPrefixes = ["/dashboard", "/chat", "/settings"] as const;

/** Path prefixes that make up the auth flow. */
export const authPrefixes = ["/login", "/register"] as const;

export function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPath(pathname: string): boolean {
  return authPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
