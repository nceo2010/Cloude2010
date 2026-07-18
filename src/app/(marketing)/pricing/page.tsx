import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
      <p className="text-muted-foreground mt-4 text-base">
        This is a placeholder pricing page. Plans will be added in a later
        milestone.
      </p>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Free</CardTitle>
          <CardDescription>Everything you need to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Coming soon.</p>
        </CardContent>
      </Card>
    </section>
  );
}
