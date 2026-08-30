import { describe, expect, it } from "vitest";
import { paginate, parsePage } from "@/lib/shared/paginate";

describe("paginate", () => {
  it("parses page from search params", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
  });

  it("returns a window over the requested page", () => {
    const items = Array.from({ length: 23 }, (_, i) => i + 1);
    const first = paginate(items, 1, 10);
    expect(first.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(first.total).toBe(23);
    expect(first.totalPages).toBe(3);
    expect(paginate(items, 3, 10).items).toEqual([21, 22, 23]);
  });

  it("clamps a page past the end", () => {
    const windowed = paginate(["a", "b"], 9, 10);
    expect(windowed.page).toBe(1);
    expect(windowed.items).toEqual(["a", "b"]);
  });
});
