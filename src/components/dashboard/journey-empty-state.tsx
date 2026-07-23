import { CreateJourneyForm } from "@/components/journeys/create-journey-form";

/** Hero-shaped placeholder shown when the user has no active Journey yet. */
export function JourneyEmptyState() {
  return (
    <section className="border-border/60 bg-card rounded-2xl border p-8 text-center shadow-sm sm:p-12 dark:shadow-none">
      <div className="mx-auto max-w-md space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Start your first Journey
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A Journey is the one goal you&apos;re focused on right now. Set it,
          and this page becomes your daily home base.
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-sm text-left">
        <CreateJourneyForm />
      </div>
    </section>
  );
}
