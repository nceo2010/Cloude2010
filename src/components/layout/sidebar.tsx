"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { APP_NAME, appNav } from "@/lib/constants";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Desktop sidebar navigation for the authenticated app shell. */
export function Sidebar({
  className,
  userEmail,
}: {
  className?: string;
  userEmail?: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-card hidden w-60 shrink-0 flex-col border-r md:flex",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b px-6">
        <Link href={routes.dashboard} className="font-semibold">
          {APP_NAME}
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {appNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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

      <div className="border-t p-4">
        {userEmail ? (
          <p
            className="text-muted-foreground mb-2 truncate px-3 text-xs"
            title={userEmail}
          >
            {userEmail}
          </p>
        ) : null}
        <SignOutButton />
      </div>
    </aside>
  );
}
