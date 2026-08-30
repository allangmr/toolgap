import { describe, expect, it } from "vitest";
import {
  clampTimeoutSeconds,
  timeoutSecondsToMs,
  TIMEOUT_SECONDS_MAX,
  TIMEOUT_SECONDS_MIN,
} from "@/lib/sessions/timeout";

describe("inactivity timeout bounds", () => {
  it("clamps below min and above max", () => {
    expect(clampTimeoutSeconds(1)).toBe(TIMEOUT_SECONDS_MIN);
    expect(clampTimeoutSeconds(99_999)).toBe(TIMEOUT_SECONDS_MAX);
    expect(timeoutSecondsToMs(180)).toBe(180_000);
  });
});
