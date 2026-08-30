"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { runAnalysis, type AnalysisResult } from "@/lib/analysis/pipeline";

interface AnalysisStatusValue {
  lastResult: AnalysisResult | null;
  pending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AnalysisStatusContext = createContext<AnalysisStatusValue>({
  lastResult: null,
  pending: false,
  error: null,
  refresh: async () => undefined,
});

export function AnalysisStatusProvider({ children }: { children: ReactNode }) {
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const result = await runAnalysis();
      setLastResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <AnalysisStatusContext.Provider value={{ lastResult, pending, error, refresh }}>
      {children}
    </AnalysisStatusContext.Provider>
  );
}

export function useAnalysisStatus(): AnalysisStatusValue {
  return useContext(AnalysisStatusContext);
}
