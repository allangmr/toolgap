"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TabPanel, Tabs } from "@/components/ui";
import { SessionsTrafficPanel } from "./SessionsTrafficPanel";
import { JourneysTrafficPanel } from "./JourneysTrafficPanel";
import { ToolsTrafficPanel } from "./ToolsTrafficPanel";

const TRAFFIC_TABS = [
  { id: "sessions", label: "Sessions" },
  { id: "journeys", label: "Journeys" },
  { id: "tools", label: "Tools" },
] as const;

export type TrafficTab = (typeof TRAFFIC_TABS)[number]["id"];

function TrafficContent() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab") ?? "sessions";
  const tab: TrafficTab =
    raw === "journeys" || raw === "tools" || raw === "sessions" ? raw : "sessions";

  function setTab(next: string) {
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set("tab", next);
    if (next !== "sessions") {
      nextParams.delete("status");
      nextParams.delete("surface");
      nextParams.delete("page");
    }
    router.push(`/traffic?${nextParams.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Traffic"
        description="Observed WebMCP sessions, reconstructed journeys, and tool performance."
      />

      <Tabs tabs={[...TRAFFIC_TABS]} active={tab} onChange={setTab} />

      <TabPanel id="sessions" active={tab}>
        <SessionsTrafficPanel />
      </TabPanel>
      <TabPanel id="journeys" active={tab}>
        <JourneysTrafficPanel />
      </TabPanel>
      <TabPanel id="tools" active={tab}>
        <ToolsTrafficPanel />
      </TabPanel>
    </div>
  );
}

export default function TrafficPageClient() {
  return (
    <Suspense fallback={<p className="text-muted">Loading traffic…</p>}>
      <TrafficContent />
    </Suspense>
  );
}
