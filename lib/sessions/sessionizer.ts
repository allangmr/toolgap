import { sessionRepo, settingsRepo } from "@/lib/db/repositories";
import { createId, nowMs } from "@/lib/shared";
import type { AgentSession, Surface } from "@/lib/shared/types";

const TAB_KEY = "toolgap_tab_id";
const SESSION_KEY = "toolgap_session_id";

interface SessionState {
  sessionId: string;
  sequenceIndex: number;
  lastActivityAt: number;
  surface: Surface;
}

let memoryState: SessionState | null = null;

function getTabId(): string {
  if (typeof sessionStorage === "undefined") {
    return "test-tab";
  }
  let tabId = sessionStorage.getItem(TAB_KEY);
  if (!tabId) {
    tabId = createId();
    sessionStorage.setItem(TAB_KEY, tabId);
  }
  return tabId;
}

function readStoredSessionId(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

function writeStoredSessionId(id: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (id) sessionStorage.setItem(SESSION_KEY, id);
  else sessionStorage.removeItem(SESSION_KEY);
}

async function restoreFromStorage(
  surface: Surface,
  now: number,
  timeoutMs: number,
): Promise<void> {
  const storedId = readStoredSessionId();
  if (!storedId) return;
  const session = await sessionRepo.get(storedId);
  if (
    !session ||
    session.status !== "active" ||
    session.surface !== surface ||
    now - session.lastActivityAt > timeoutMs
  ) {
    writeStoredSessionId(null);
    return;
  }
  memoryState = {
    sessionId: session.id,
    sequenceIndex: session.callCount,
    lastActivityAt: session.lastActivityAt,
    surface: session.surface,
  };
}

export async function nextCallContext(surface: Surface): Promise<{
  sessionId: string;
  sequenceIndex: number;
}> {
  const settings = await settingsRepo.get();
  const now = nowMs();
  const tabId = getTabId();

  if (!memoryState) {
    await restoreFromStorage(surface, now, settings.inactivityTimeoutMs);
  }

  const expired =
    !memoryState ||
    memoryState.surface !== surface ||
    now - memoryState.lastActivityAt > settings.inactivityTimeoutMs;

  if (expired) {
    const sessionId = createId();
    memoryState = {
      sessionId,
      sequenceIndex: 0,
      lastActivityAt: now,
      surface,
    };
    writeStoredSessionId(sessionId);

    const session: AgentSession = {
      id: sessionId,
      surface,
      startedAt: now,
      lastActivityAt: now,
      status: "active",
      callCount: 0,
      tabId,
    };
    await sessionRepo.upsert(session);
  }

  memoryState!.sequenceIndex += 1;
  memoryState!.lastActivityAt = now;

  const session = await sessionRepo.get(memoryState!.sessionId);
  if (session) {
    session.lastActivityAt = now;
    session.callCount += 1;
    await sessionRepo.upsert(session);
  }

  return {
    sessionId: memoryState!.sessionId,
    sequenceIndex: memoryState!.sequenceIndex,
  };
}

export function resetSessionizer(): void {
  memoryState = null;
  writeStoredSessionId(null);
}

export function peekSessionizer(): SessionState | null {
  return memoryState;
}

/** Test helper to inject session state with fake timers. */
export function setSessionizerStateForTests(state: SessionState | null): void {
  memoryState = state;
  if (state) writeStoredSessionId(state.sessionId);
  else writeStoredSessionId(null);
}

/** Simulate a tab reload: drop in-memory state, keep sessionStorage. */
export function clearMemoryForTests(): void {
  memoryState = null;
}

export async function finalizeExpiredSessions(
  now = nowMs(),
): Promise<AgentSession[]> {
  const settings = await settingsRepo.get();
  const active = await sessionRepo.active();
  const finalized: AgentSession[] = [];
  for (const session of active) {
    if (now - session.lastActivityAt > settings.inactivityTimeoutMs) {
      session.status = "expired";
      session.endedAt = session.lastActivityAt;
      await sessionRepo.upsert(session);
      finalized.push(session);
    }
  }
  return finalized;
}

export async function completeSession(sessionId: string): Promise<void> {
  const session = await sessionRepo.get(sessionId);
  if (!session) return;
  session.status = "completed";
  session.endedAt = session.lastActivityAt;
  await sessionRepo.upsert(session);
}

export function getOrCreateTabId(): string {
  return getTabId();
}

export function getStoredSessionId(): string | null {
  return readStoredSessionId() ?? memoryState?.sessionId ?? null;
}
