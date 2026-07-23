import Link from "next/link";

import { ProgressBar } from "@/components/ui/progress-bar";
import { buildHeroContextLine } from "@/lib/dashboard/insight";
import { routes } from "@/lib/routes";
import type { Journey } from "@/lib/supabase/types";

type JourneyHeroProps = {
  journey: Journey;
};

/**
 * The dashboard's primary focus: the user's single active Journey, presented
 * as something to look at and continue, not a record to edit. Editing still
 * exists — see JourneyManage — just not here.
 */
export function JourneyHero({ journey }: JourneyHeroProps) {
  const progress = journey.progress_percentage ?? 0;
  const contextLine = buildHeroContextLine(journey);

  return (
    <section className="border-border/60 bg-card rounded-2xl border p-6 shadow-sm sm:p-8 dark:shadow-none">
      <div className="flex flex-col gap-5">
        <div className="space-y-1.5">
          {journey.current_stage ? (
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {journey.current_stage}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {journey.title}
          </h1>
          <p className="text-foreground/80 text-sm sm:text-base">
            {contextLine}
          </p>
          {journey.goal_description ? (
            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
              {journey.goal_description}
            </p>
          ) : null}
        </div>

        <div className="border-border/60 flex flex-col gap-5 border-t pt-5 sm:flex-row sm:gap-8">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Progress
              </p>
              <p className="text-sm font-medium">{progress}%</p>
            </div>
            <ProgressBar value={progress} className="h-1.5" />
          </div>

          {journey.next_step ? (
            <div className="flex-1 space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Today&apos;s goal
              </p>
              <p className="text-sm leading-relaxed sm:text-base">
                {journey.next_step}
              </p>
            </div>
          ) : null}
        </div>

        <Link
          href={routes.chat}
          className="group bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md px-6 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Continue Journey
          <span
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
