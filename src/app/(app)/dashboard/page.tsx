import type { Metadata } from "next";

import { CreateJourneyForm } from "@/components/journeys/create-journey-form";
import { JourneyCard } from "@/components/journeys/journey-card";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveJourney } from "@/lib/journeys/queries";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const journey = await getActiveJourney();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="An overview of your progress."
      />

      {journey ? (
        <JourneyCard journey={journey} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create your journey</CardTitle>
            <CardDescription>
              You don&apos;t have an active journey yet. Set one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateJourneyForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
