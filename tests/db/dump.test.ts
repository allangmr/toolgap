import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import { exportDump, importDump } from "@/lib/db/dump";
import { sessionRepo, settingsRepo } from "@/lib/db/repositories";
import { resetSessionizer } from "@/lib/sessions/sessionizer";

describe("IndexedDB dump", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
  });

  it("round-trips sessions through export and import", async () => {
    await sessionRepo.upsert({
      id: "s-dump",
      surface: "store",
      startedAt: 10,
      lastActivityAt: 20,
      status: "expired",
      callCount: 4,
      tabId: "tab",
    });
    const dump = await exportDump();
    expect(dump.sessions?.some((row) => row.id === "s-dump")).toBe(true);

    await sessionRepo.upsert({
      id: "s-other",
      surface: "store",
      startedAt: 30,
      lastActivityAt: 40,
      status: "expired",
      callCount: 1,
      tabId: "tab",
    });

    await importDump(dump);
    expect(await sessionRepo.get("s-dump")).toMatchObject({ callCount: 4 });
    expect(await sessionRepo.get("s-other")).toBeUndefined();
  });

  it("rejects unknown tables", async () => {
    await expect(importDump({ not_a_table: [{ id: "x" }] })).rejects.toThrow(
      /Unknown table/,
    );
  });

  it("restores settings when the dump omitted them", async () => {
    await importDump({ sessions: [] });
    const settings = await settingsRepo.get();
    expect(settings.inactivityTimeoutMs).toBeGreaterThan(0);
  });
});
