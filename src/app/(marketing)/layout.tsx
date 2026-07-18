import Link from "next/link";
import * as React from "react";

import { APP_NAME, marketingNav } from "@/lib/constants";
import { routes } from "@/lib/routes";

/** Public marketing layout: top nav + footer around page content. */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={routes.home} className="font-semibold">
            {APP_NAME}
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {marketingNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={routes.login}
              className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
            >
              Log in
            </Link>
            <Link
              href={routes.register}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-8 text-sm sm:px-6">
          © {APP_NAME}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
