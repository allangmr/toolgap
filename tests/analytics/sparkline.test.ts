import { describe, expect, it } from "vitest";
import { sparklineValues } from "@/lib/analytics/sparkline";

describe("sparklineValues", () => {
  it("returns undefined below two points", () => {
    expect(sparklineValues([])).toBeUndefined();
    expect(sparklineValues([{ at: 1, value: 4 }])).toBeUndefined();
  });

  it("sorts by time and keeps the last n values", () => {
    expect(
      sparklineValues(
        [
          { at: 30, value: 9 },
          { at: 10, value: 1 },
          { at: 20, value: 4 },
        ],
        2,
      ),
    ).toEqual([4, 9]);
  });
});
