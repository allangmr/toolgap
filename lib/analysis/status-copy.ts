import type { AnalysisResult } from "@/lib/analysis/pipeline";

export function formatAnalysisRunSummary(result: AnalysisResult): string {
  return `This run: ${result.journeysBuilt} new journeys · ${result.signalsCreated} new signals`;
}

export function formatAnalysisStoredTotals(args: {
  journeys: number;
  signals: number;
}): string {
  return `Stored: ${args.journeys} journeys · ${args.signals} signals`;
}

export function formatAnalysisStatus(args: {
  result: AnalysisResult | null;
  storedJourneys: number;
  storedSignals: number;
  error?: string | null;
}): { primary: string; secondary?: string } {
  if (args.error) {
    return { primary: `Error: ${args.error}` };
  }
  if (!args.result) {
    return { primary: "No analysis yet" };
  }
  return {
    primary: formatAnalysisRunSummary(args.result),
    secondary: formatAnalysisStoredTotals({
      journeys: args.storedJourneys,
      signals: args.storedSignals,
    }),
  };
}
