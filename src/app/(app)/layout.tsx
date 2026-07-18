import { redirect } from "next/navigation";
import * as React from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/user";
import { routes } from "@/lib/routes";

/**
 * Authenticated app layout. Middleware already guards these routes; this
 * server-side check is defense-in-depth and gives the shell the user's
 * identity to display.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(routes.login);
  }

  return <AppShell userEmail={user.email ?? null}>{children}</AppShell>;
}
