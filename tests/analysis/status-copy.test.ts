import { describe, expect, it } from "vitest";
import {
  formatAnalysisRunSummary,
  formatAnalysisStatus,
  formatAnalysisStoredTotals,
} from "@/lib/analysis/status-copy";

describe("analysis status copy", () => {
  it("describes per-run deltas without implying zero totals", () => {
    expect(
      formatAnalysisRunSummary({
        journeysBuilt: 0,
        signalsCreated: 0,
        finalizedSessions: 0,
        gapsUpdated: 0,
        at: 1,
      }),
    ).toBe("This run: 0 new journeys · 0 new signals");
  });

  it("shows stored totals separately", () => {
    expect(formatAnalysisStoredTotals({ journeys: 8, signals: 12 })).toBe(
      "Stored: 8 journeys · 12 signals",
    );
  });

  it("does not read like the database is empty when nothing changed this run", () => {
    const status = formatAnalysisStatus({
      result: {
        journeysBuilt: 0,
        signalsCreated: 0,
        finalizedSessions: 0,
        gapsUpdated: 0,
        at: 1,
      },
      storedJourneys: 8,
      storedSignals: 12,
    });
    expect(status.primary).toContain("0 new journeys");
    expect(status.secondary).toContain("Stored: 8 journeys");
  });
});
