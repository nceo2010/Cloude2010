import type { Metadata } from "next";

import { CreateGoalForm } from "@/components/goals/create-goal-form";
import { GoalCard } from "@/components/goals/goal-card";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveGoal } from "@/lib/goals/queries";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const goal = await getActiveGoal();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="An overview of your progress."
      />

      {goal ? (
        <GoalCard goal={goal} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create your goal</CardTitle>
            <CardDescription>
              You don&apos;t have an active goal yet. Set one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateGoalForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
