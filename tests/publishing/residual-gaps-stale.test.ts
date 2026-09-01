import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { resetDbForTests } from "@/lib/db/schema";
import { gapRepo, recommendationRepo } from "@/lib/db/repositories";
import { buildRecommendation } from "@/lib/recommendations/builder";
import { approveRecommendation, publishRecommendation } from "@/lib/publishing/publish";
import { createNoopAdapter } from "@/lib/webmcp/adapter";
import { resetRegistryForTests } from "@/lib/webmcp/registry";
import { ensureCatalogSeeded } from "@/lib/store-domain/services";
import { resetSessionizer } from "@/lib/sessions/sessionizer";
import type { CapabilityGap, GapType } from "@/lib/shared/types";

function gap(
  id: string,
  type: GapType,
  sessions: string[],
  overrides: Partial<CapabilityGap> = {},
): CapabilityGap {
  return {
    id,
    title: `gap ${id}`,
    type,
    entityType: "product",
    detectedIntent: "comparison",
    status: "detected",
    confidence: 0.7,
    severity: "medium",
    supportingSessionIds: sessions,
    affectedSessions: sessions.length,
    percentageOfRelevantJourneys: 0.5,
    currentAvgCallCount: 6,
    currentCompletionRate: 0,
    signalIds: [`f-${id}`],
    mergeKey: `${type}:product:${id}`,
    firstDetectedAt: 1,
    lastDetectedAt: 1,
    statusHistory: [{ status: "detected", at: 1, by: "system" }],
    ...overrides,
  };
}

describe("publishing marks residual gaps as stale evidence", () => {
  beforeEach(async () => {
    const db = resetDbForTests();
    await db.delete();
    resetDbForTests();
    resetSessionizer();
    const registry = resetRegistryForTests();
    registry.setAdapterForTests(createNoopAdapter());
    await ensureCatalogSeeded();
  });

  it("flags open siblings backed only by the resolved gap's sessions", async () => {
    const compare = gap("g-compare", "COMPARE", ["s1", "s2", "s3"]);
    // Same pre-publish workaround sessions → residual once compare ships.
    const filter = gap("g-filter", "FILTER", ["s1", "s2", "s3"]);
    // Has independent evidence from s4 → must stay untouched.
    const bulk = gap("g-bulk", "BULK_READ", ["s2", "s3", "s4"]);
    // Dismissed gaps are out of scope.
    const dismissed = gap("g-dismissed", "FILTER", ["s1"], {
      status: "dismissed",
      mergeKey: "FILTER:product:dismissed",
    });
    await gapRepo.put(compare);
    await gapRepo.put(filter);
    await gapRepo.put(bulk);
    await gapRepo.put(dismissed);

    const built = buildRecommendation(compare);
    if (!built.ok) throw new Error("expected a COMPARE recommendation");
    await recommendationRepo.put(built.recommendation);
    await approveRecommendation(built.recommendation.id);
    const cap = await publishRecommendation(built.recommendation.id);

    const resolved = await gapRepo.get("g-compare");
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.staleEvidenceCapabilityId).toBeUndefined();

    const staleFilter = await gapRepo.get("g-filter");
    expect(staleFilter?.status).toBe("detected");
    expect(staleFilter?.staleEvidenceCapabilityId).toBe(cap.id);
    expect(staleFilter?.staleEvidenceAt).toBeGreaterThan(0);

    const freshBulk = await gapRepo.get("g-bulk");
    expect(freshBulk?.staleEvidenceCapabilityId).toBeUndefined();

    const untouched = await gapRepo.get("g-dismissed");
    expect(untouched?.staleEvidenceCapabilityId).toBeUndefined();
  });
});
