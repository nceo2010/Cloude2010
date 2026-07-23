import { ChevronDownIcon } from "@/components/dashboard/icons";
import { JourneyCard } from "@/components/journeys/journey-card";
import type { Journey } from "@/lib/supabase/types";

type JourneyManageProps = {
  journey: Journey;
};

/**
 * Demotes Journey editing (JourneyCard, unchanged) behind a collapsed
 * disclosure the user is meant to skip past unless they're looking for it —
 * deliberately without its own card chrome (no border/background/shadow),
 * so it reads as a low-priority utility rather than a peer of the content
 * cards above it. Nothing about editing/completing/deleting a Journey
 * changes — only its prominence on the page does.
 */
export function JourneyManage({ journey }: JourneyManageProps) {
  return (
    <details className="group">
      <summary className="text-muted-foreground/70 hover:text-foreground flex w-fit cursor-pointer list-none items-center gap-1.5 py-2 text-xs font-medium tracking-wide transition-colors [&::-webkit-details-marker]:hidden">
        Manage journey
        <ChevronDownIcon className="size-3.5 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="pt-3 pb-1">
        <JourneyCard journey={journey} />
      </div>
    </details>
  );
}
