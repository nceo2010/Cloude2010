"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { APP_NAME, appNav } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Mobile navigation: a toggle button that reveals the app nav links.
 * Hidden on md+ where the sidebar takes over.
 */
export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("md:hidden", className)}>
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link href={routes.dashboard} className="font-semibold">
          {APP_NAME}
        </Link>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Close" : "Menu"}
        </Button>
      </div>

      {open ? (
        <nav
          id="mobile-nav-menu"
          className="bg-card flex flex-col gap-1 border-b p-4"
        >
          {appNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
