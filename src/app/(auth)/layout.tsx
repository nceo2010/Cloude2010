import Link from "next/link";
import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { routes } from "@/lib/routes";

/** Centered, minimal layout for the auth flow (login / register). */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href={routes.home} className="mb-8 text-lg font-semibold">
        {APP_NAME}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
