import { toolCallRepo, settingsRepo } from "@/lib/db/repositories";
import type { ToolCallEvent } from "@/lib/shared/types";

const BUFFER_LIMIT = 10;
const FLUSH_MS = 2000;
const RETRY_LIMIT = 50;

class TelemetryRecorder {
  private buffer: ToolCallEvent[] = [];
  private retryQueue: ToolCallEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private degraded = false;
  private listenersAttached = false;
  private listeners = new Set<(degraded: boolean) => void>();

  get isDegraded(): boolean {
    return this.degraded;
  }

  record(event: ToolCallEvent): void {
    this.buffer.push(event);
    this.ensureLifecycleListeners();
    if (this.buffer.length >= BUFFER_LIMIT) {
      void this.flush();
      return;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, FLUSH_MS);
    }
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = [...this.retryQueue, ...this.buffer];
    this.buffer = [];
    this.retryQueue = [];
    if (batch.length === 0) return;

    try {
      await toolCallRepo.bulkAdd(batch);
      this.setDegraded(false);
      await this.enforceCap();
    } catch (error) {
      console.warn("[toolgap] telemetry flush failed", error);
      this.setDegraded(true);
      this.retryQueue = batch.slice(-RETRY_LIMIT);
    }
  }

  subscribe(listener: (degraded: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setDegraded(next: boolean): void {
    if (this.degraded === next) return;
    this.degraded = next;
    for (const listener of this.listeners) listener(this.degraded);
  }

  private async enforceCap(): Promise<void> {
    const settings = await settingsRepo.get();
    const count = await toolCallRepo.count();
    const excess = count - settings.maxTelemetryEvents;
    if (excess <= 0) return;
    await toolCallRepo.pruneOldest(excess);
  }

  private ensureLifecycleListeners(): void {
    if (this.listenersAttached || typeof document === "undefined") return;
    this.listenersAttached = true;
    const flush = () => {
      void this.flush();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }
}

export const telemetryRecorder = new TelemetryRecorder();

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
