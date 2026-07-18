import * as React from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * The authenticated app shell: persistent sidebar on desktop, collapsible
 * nav on mobile, and a scrollable main content area.
 */
export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar userEmail={userEmail} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav userEmail={userEmail} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
