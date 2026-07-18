import type { Metadata } from "next";

import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">About {APP_NAME}</h1>
      <p className="text-muted-foreground mt-4 text-base">
        This is a placeholder about page. Content will be added in a later
        milestone.
      </p>
    </section>
  );
}
