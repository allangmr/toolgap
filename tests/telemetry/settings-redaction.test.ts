import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { resetDbForTests } from "@/lib/db/schema";
import { settingsRepo, toolCallRepo } from "@/lib/db/repositories";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import { telemetryRecorder } from "@/lib/telemetry/recorder";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { resetRegistryForTests } from "@/lib/webmcp/registry";
import { driveTool } from "@/lib/webmcp/driver";

describe("settings redaction wiring", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
    const registry = resetRegistryForTests();
    registry.setAdapterForTests(createNoopAdapter());
    await registry.registerTool({
      name: "echo_params",
      description: "Echo params for redaction tests",
      version: "1.0.0",
      inputSchema: z.object({
        nickname: z.string().optional(),
        internalId: z.string().optional(),
        productId: z.string().optional(),
      }),
      handler: async (params) => params,
      surface: "store",
      origin: "static",
      readOnly: true,
      redactKeys: ["internalId"],
    });
  });

  it("redacts settings keys and per-tool keys together", async () => {
    const settings = await settingsRepo.get();
    await settingsRepo.put({
      ...settings,
      redactionKeys: [...settings.redactionKeys, "nickname"],
    });

    await driveTool("echo_params", {
      nickname: "Ada",
      internalId: "secret-row",
      productId: "hp-01",
    });
    await telemetryRecorder.flush();

    const events = await toolCallRepo.byTool("echo_params");
    expect(events).toHaveLength(1);
    expect(events[0]!.input.nickname).toBe("[redacted]");
    expect(events[0]!.input.internalId).toBe("[redacted]");
    expect(events[0]!.input.productId).toBe("hp-01");
  });
});
