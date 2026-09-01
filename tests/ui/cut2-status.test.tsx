import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { resetDbForTests } from "@/lib/db/schema";
import { publishedRepo, toolCallRepo } from "@/lib/db/repositories";
import { WebmcpStatusProvider } from "@/components/providers/WebmcpStatusProvider";
import { AnalysisStatusProvider } from "@/components/providers/AnalysisStatusProvider";
import { WebmcpStatusBadge } from "@/components/dashboard/WebmcpStatusBadge";
import { TelemetryDegradedBanner } from "@/components/dashboard/TelemetryDegradedBanner";
import { DbBootstrap } from "@/components/providers/DbBootstrap";
import PublishedPage from "@/app/(dashboard)/published/page";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import {
  getRegistry,
  resetRegistryForTests,
  type ToolgapToolDefinition,
} from "@/lib/webmcp/registry";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import type { PublishedCapability } from "@/lib/shared/types";

function dummyTool(name: string): ToolgapToolDefinition {
  return {
    name,
    description: "test tool",
    version: "1.0.0",
    inputSchema: z.object({}),
    handler: async () => ({ ok: true }),
    surface: "store",
    origin: "static",
  };
}

const cap: PublishedCapability = {
  id: "cap-ui-boot",
  recommendationId: "rec-ui-boot",
  toolName: "compare_products",
  templateType: "COMPARE",
  config: {
    entity: "product",
    fields: ["id", "name"],
    maxBatchSize: 10,
    toolName: "compare_products",
    description: "boot",
  },
  version: 1,
  status: "active",
  publishedAt: 1,
  schemaJson: {},
};

describe("Cut 2 status surfaces", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetRegistryForTests();
    getRegistry().setAdapterForTests(createNoopAdapter());
  });

  it("opens a registry error popover from the WebMCP badge", async () => {
    const user = userEvent.setup();
    const registry = getRegistry();
    registry.setAdapterForTests({
      kind: "native",
      available: true,
      async register() {
        throw new Error("denied");
      },
      unregister() {
        return;
      },
    });
    await expect(registry.registerTool(dummyTool("broken"))).rejects.toThrow(
      "denied",
    );

    render(
      <WebmcpStatusProvider>
        <WebmcpStatusBadge />
      </WebmcpStatusProvider>,
    );

    const summary = await screen.findByText(/WebMCP native · 1 error/);
    await user.click(summary);
    expect(await screen.findByRole("dialog", { name: "WebMCP registry errors" })).toHaveTextContent(
      "denied",
    );
  });

  it("shows the telemetry degraded banner after a failed flush", async () => {
    const spy = vi
      .spyOn(toolCallRepo, "bulkAdd")
      .mockRejectedValue(new Error("quota"));
    telemetryRecorder.record({
      id: "e-ui",
      sessionId: "s1",
      timestamp: 1,
      sequenceIndex: 1,
      toolName: "search_products",
      toolVersion: "1.0.0",
      origin: "static",
      surface: "store",
      input: {},
      resultMeta: { ok: true },
      success: true,
      durationMs: 1,
      page: "/store",
    });
    await telemetryRecorder.flush();
    spy.mockRestore();

    render(
      <WebmcpStatusProvider>
        <TelemetryDegradedBanner />
      </WebmcpStatusProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status"),
      ).toHaveTextContent("Telemetry writes are failing");
    });
  });

  it("restores published tools on store tabs when DbBootstrap finishes", async () => {
    await ensureCatalogSeeded();
    await publishedRepo.put(cap);
    window.history.replaceState(null, "", "/store");
    expect(getRegistry().has("compare_products")).toBe(false);

    render(
      <DbBootstrap>
        <p>store ready</p>
      </DbBootstrap>,
    );

    expect(await screen.findByText("store ready")).toBeInTheDocument();
    await waitFor(() => {
      expect(getRegistry().has("compare_products")).toBe(true);
    });
  });

  it("keeps store dynamic tools off the dashboard tab", async () => {
    await ensureCatalogSeeded();
    await publishedRepo.put(cap);
    window.history.replaceState(null, "", "/published");

    render(
      <AnalysisStatusProvider>
        <DbBootstrap>
          <PublishedPage />
        </DbBootstrap>
      </AnalysisStatusProvider>,
    );

    expect(
      await screen.findByText(/not exposed on this dashboard tab/i),
    ).toBeInTheDocument();
    expect(getRegistry().has("compare_products")).toBe(false);
  });
});
