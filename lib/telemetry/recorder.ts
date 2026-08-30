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
      this.degraded = false;
      await this.enforceCap();
    } catch (error) {
      console.warn("[toolgap] telemetry flush failed", error);
      this.degraded = true;
      this.retryQueue = batch.slice(-RETRY_LIMIT);
    }
  }

  private async enforceCap(): Promise<void> {
    const settings = await settingsRepo.get();
    const count = await toolCallRepo.count();
    if (count <= settings.maxTelemetryEvents) return;
    // Soft notice only — pruning oldest sessions is handled by settings actions for MVP.
    console.info(
      `[toolgap] telemetry count ${count} exceeds cap ${settings.maxTelemetryEvents}`,
    );
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
