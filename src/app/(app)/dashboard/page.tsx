import type { Metadata } from "next";
import Link from "next/link";

import { InsightCard } from "@/components/dashboard/insight-card";
import { JourneyEmptyState } from "@/components/dashboard/journey-empty-state";
import { JourneyHero } from "@/components/dashboard/journey-hero";
import { JourneyManage } from "@/components/dashboard/journey-manage";
import { RecentConversations } from "@/components/dashboard/recent-conversations";
import { StatCard } from "@/components/dashboard/stat-card";
import { getRecentConversations } from "@/lib/chat/queries";
import { buildJourneyInsight } from "@/lib/dashboard/insight";
import { getActivityStreak } from "@/lib/dashboard/queries";
import {
  getActiveJourney,
  getCompletedJourneyCount,
} from "@/lib/journeys/queries";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Dashboard",
};

const RECENT_CONVERSATIONS_LIMIT = 4;

export default async function DashboardPage() {
  const [journey, streak, completedCount, recentConversations] =
    await Promise.all([
      getActiveJourney(),
      getActivityStreak(),
      getCompletedJourneyCount(),
      getRecentConversations(RECENT_CONVERSATIONS_LIMIT),
    ]);

  const insight = buildJourneyInsight(journey, streak);

  return (
    <div className="space-y-8 pb-2">
      {journey ? <JourneyHero journey={journey} /> : <JourneyEmptyState />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Streak"
          value={streak > 0 ? `${streak} day${streak === 1 ? "" : "s"}` : "—"}
        />
        <StatCard label="Completed" value={String(completedCount)} />
        <StatCard
          label="Overall progress"
          value={journey ? `${journey.progress_percentage ?? 0}%` : "—"}
        />
      </div>

      <InsightCard message={insight} />

      <RecentConversations conversations={recentConversations} />

      <div className="border-border/50 border-t pt-1">
        {journey ? <JourneyManage journey={journey} /> : null}
        <div className="flex justify-center py-2">
          <Link
            href={routes.settings}
            className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
          >
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
