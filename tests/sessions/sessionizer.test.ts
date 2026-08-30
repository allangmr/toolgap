import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db/schema";
import { sessionRepo, settingsRepo } from "@/lib/db/repositories";
import {
  clearMemoryForTests,
  nextCallContext,
  resetSessionizer,
} from "@/lib/sessions/sessionizer";

async function reset() {
  const db = resetDbForTests();
  await db.delete();
  resetDbForTests();
  resetSessionizer();
}

describe("sessionizer restore", () => {
  beforeEach(async () => {
    await reset();
  });

  it("keeps the same session id after reload within the inactivity window", async () => {
    const first = await nextCallContext("store");
    clearMemoryForTests();
    const second = await nextCallContext("store");
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.sequenceIndex).toBe(2);
    const session = await sessionRepo.get(first.sessionId);
    expect(session?.callCount).toBe(2);
    expect(session?.status).toBe("active");
  });

  it("creates a new session when the stored session is past the inactivity timeout", async () => {
    const first = await nextCallContext("store");
    const settings = await settingsRepo.get();
    const session = await sessionRepo.get(first.sessionId);
    expect(session).toBeDefined();
    session!.lastActivityAt -= settings.inactivityTimeoutMs + 1;
    await sessionRepo.upsert(session!);
    clearMemoryForTests();
    const second = await nextCallContext("store");
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.sequenceIndex).toBe(1);
  });

  it("falls back when the stored id is unknown", async () => {
    sessionStorage.setItem("toolgap_session_id", "missing-session");
    const ctx = await nextCallContext("store");
    expect(ctx.sessionId).not.toBe("missing-session");
    expect(ctx.sequenceIndex).toBe(1);
  });

  it("creates a new session when the stored session is a different surface", async () => {
    const storeCall = await nextCallContext("store");
    clearMemoryForTests();
    const dashCall = await nextCallContext("dashboard");
    expect(dashCall.sessionId).not.toBe(storeCall.sessionId);
  });
});
