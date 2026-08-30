export const TIMEOUT_SECONDS_MIN = 30;
export const TIMEOUT_SECONDS_MAX = 3600;

export function clampTimeoutSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return TIMEOUT_SECONDS_MIN;
  return Math.min(
    TIMEOUT_SECONDS_MAX,
    Math.max(TIMEOUT_SECONDS_MIN, Math.round(seconds)),
  );
}

export function timeoutSecondsToMs(seconds: number): number {
  return clampTimeoutSeconds(seconds) * 1000;
}

export function timeoutMsToSeconds(ms: number): number {
  return Math.round(ms / 1000);
}
