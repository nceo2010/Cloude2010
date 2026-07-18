import Link from "next/link";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { routes } from "@/lib/routes";

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Welcome to {APP_NAME}
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg">
        {APP_DESCRIPTION}
      </p>
      <div className="flex items-center gap-3">
        <Link
          href={routes.register}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center rounded-md px-6 text-base font-medium transition-colors"
        >
          Get started
        </Link>
        <Link
          href={routes.about}
          className="border-input hover:bg-accent hover:text-accent-foreground inline-flex h-11 items-center rounded-md border px-6 text-base font-medium transition-colors"
        >
          Learn more
        </Link>
      </div>
    </section>
  );
}
