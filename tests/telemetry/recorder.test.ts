import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import { settingsRepo, toolCallRepo } from "@/lib/db/repositories";
import {
  requestPersistentStorage,
  telemetryRecorder,
} from "@/lib/telemetry/recorder";
import type { ToolCallEvent } from "@/lib/shared/types";

function event(id: string, timestamp: number): ToolCallEvent {
  return {
    id,
    sessionId: "s1",
    timestamp,
    sequenceIndex: timestamp,
    toolName: "search_products",
    toolVersion: "1.0.0",
    origin: "static",
    surface: "store",
    input: {},
    resultMeta: { ok: true },
    success: true,
    durationMs: 10,
    page: "/store",
  };
}

describe("telemetry cap and persist", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    await settingsRepo.put({
      ...(await settingsRepo.get()),
      maxTelemetryEvents: 5,
    });
  });

  afterEach(async () => {
    await telemetryRecorder.flush();
  });

  it("prunes oldest events when the cap is exceeded", async () => {
    for (let i = 0; i < 8; i++) {
      telemetryRecorder.record(event(`e${i}`, i + 1));
    }
    await telemetryRecorder.flush();
    const remaining = await toolCallRepo.all();
    expect(remaining).toHaveLength(5);
    expect(remaining.map((e) => e.id)).toEqual(["e3", "e4", "e5", "e6", "e7"]);
  });

  it("keeps recording when persist() throws", async () => {
    const persist = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", {
      ...navigator,
      storage: { persist },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
    telemetryRecorder.record(event("ok", 1));
    await telemetryRecorder.flush();
    expect(await toolCallRepo.count()).toBe(1);
    vi.unstubAllGlobals();
  });
});
