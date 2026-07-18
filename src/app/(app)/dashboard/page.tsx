import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="An overview of your progress."
      />
      <EmptyState
        title="Nothing here yet"
        description="Your dashboard content will appear here in a future milestone."
      />
    </div>
  );
}
