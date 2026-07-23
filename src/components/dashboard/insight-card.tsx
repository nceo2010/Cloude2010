type InsightCardProps = {
  message: string;
};

/** A single personalized check-in message. See `buildJourneyInsight` for how it's derived. */
export function InsightCard({ message }: InsightCardProps) {
  return (
    <section className="border-border/60 bg-card rounded-2xl border p-6 shadow-sm sm:p-7 dark:shadow-none">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Today&apos;s Focus
      </p>
      <p className="mt-2 text-sm leading-relaxed sm:text-base">{message}</p>
    </section>
  );
}
