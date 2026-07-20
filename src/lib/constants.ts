/**
 * Application-wide constants.
 *
 * Values that are referenced across the app but are not routes and not
 * environment-specific configuration.
 */

import { routes } from "@/lib/routes";

export const APP_NAME = "Progress";
export const APP_DESCRIPTION =
  "Track your progress and stay on top of what matters.";

/** Primary navigation shown in the marketing header. */
export const marketingNav = [
  { label: "Home", href: routes.home },
  { label: "About", href: routes.about },
  { label: "Pricing", href: routes.pricing },
] as const;

/** Sidebar navigation for the authenticated app shell. */
export const appNav = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Chat", href: routes.chat },
  { label: "Settings", href: routes.settings },
] as const;

export type NavItem = {
  label: string;
  href: string;
};
