import { describe, expect, it } from "vitest";
import {
  buildRecommendation,
  configOverrideFrom,
  type BuildResult,
} from "@/lib/recommendations/builder";
import type { CapabilityGap, Recommendation } from "@/lib/shared/types";

function gap(type: CapabilityGap["type"] = "COMPARE"): CapabilityGap {
  return {
    id: "g1",
    title: "t",
    type,
    entityType: type === "AVAILABILITY_BATCH" ? "inventory" : "product",
    detectedIntent: "comparison",
    status: "detected",
    confidence: 0.8,
    severity: "high",
    supportingSessionIds: ["s1", "s2", "s3"],
    affectedSessions: 3,
    percentageOfRelevantJourneys: 0.5,
    currentAvgCallCount: 6,
    currentCompletionRate: 0,
    signalIds: ["f1"],
    mergeKey: `${type}:product:get_product`,
    firstDetectedAt: 1,
    lastDetectedAt: 1,
    statusHistory: [{ status: "detected", at: 1, by: "system" }],
  };
}

function expectOk(result: BuildResult): Recommendation {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.recommendation;
}

function expectIssues(result: BuildResult): string[] {
  if (result.ok || result.reason !== "invalid_config") {
    throw new Error("expected invalid_config");
  }
  return result.issues;
}

describe("human config override", () => {
  it("applies name, description, batch size, and fields", () => {
    const rec = expectOk(
      buildRecommendation(gap(), {
        override: {
          toolName: "compare_gear",
          description: "Compare commuting headphones side by side.",
          maxBatchSize: 4,
          fields: ["id", "name", "specs.battery"],
        },
      }),
    );

    expect(rec.proposedToolName).toBe("compare_gear");
    expect(rec.description).toBe("Compare commuting headphones side by side.");
    expect(rec.templateConfig).toMatchObject({
      toolName: "compare_gear",
      maxBatchSize: 4,
      fields: ["id", "name", "specs.battery"],
    });
  });

  it("regenerates the input schema from the edited batch size", () => {
    const rec = expectOk(
      buildRecommendation(gap(), { override: { maxBatchSize: 3 } }),
    );
    expect(JSON.stringify(rec.inputSchemaJson)).toContain("3");
  });

  it("rejects a batch size above the template maximum", () => {
    const issues = expectIssues(
      buildRecommendation(gap(), { override: { maxBatchSize: 50 } }),
    );
    expect(issues.join(" ")).toMatch(/maxBatchSize/);
  });

  it("rejects a batch size below the template minimum", () => {
    const issues = expectIssues(
      buildRecommendation(gap(), { override: { maxBatchSize: 1 } }),
    );
    expect(issues.join(" ")).toMatch(/maxBatchSize/);
  });

  it("drops a field outside the product whitelist", () => {
    const rec = expectOk(
      buildRecommendation(gap(), {
        override: { fields: ["id", "name", "internal_cost", "supplier_email"] },
      }),
    );
    expect(rec.templateConfig.fields).toEqual(["id", "name"]);
  });

  it("rejects an override whose fields are all outside the whitelist", () => {
    const issues = expectIssues(
      buildRecommendation(gap(), { override: { fields: ["internal_cost"] } }),
    );
    expect(issues.join(" ")).toMatch(/fields/);
  });

  it("rejects an explicit tool name that is already published", () => {
    const issues = expectIssues(
      buildRecommendation(gap(), {
        takenToolNames: ["compare_products"],
        override: { toolName: "compare_products" },
      }),
    );
    expect(issues.join(" ")).toMatch(/already published/);
  });

  it("does not silently suffix a human-supplied name", () => {
    const result = buildRecommendation(gap(), {
      takenToolNames: ["compare_products"],
      override: { toolName: "compare_gear" },
    });
    expect(expectOk(result).proposedToolName).toBe("compare_gear");
  });

  it("still suffixes the machine default when the name is taken", () => {
    const rec = expectOk(
      buildRecommendation(gap(), { takenToolNames: ["compare_products"] }),
    );
    expect(rec.proposedToolName).toBe("compare_products_v2");
  });

  it("returns no_template for an observational gap even with an override", () => {
    const result = buildRecommendation(gap("FILTER"), {
      override: { toolName: "filter_products" },
    });
    expect(result).toEqual({ ok: false, reason: "no_template" });
  });

  it("resets status to ready so a rebuilt recommendation needs re-approval", () => {
    const rec = expectOk(
      buildRecommendation(gap(), { override: { description: "edited" } }),
    );
    expect(rec.status).toBe("ready");
  });

  it("round-trips a stored config into an editable override", () => {
    const rec = expectOk(buildRecommendation(gap()));
    const override = configOverrideFrom(rec.templateConfig);
    expect(override.toolName).toBe("compare_products");
    expect(override.maxBatchSize).toBe(10);
    expect(override.fields?.length).toBeGreaterThan(0);
    const rebuilt = expectOk(buildRecommendation(gap(), { override }));
    expect(rebuilt.templateConfig).toEqual(rec.templateConfig);
  });

  it("omits fields for a template that has none", () => {
    const rec = expectOk(buildRecommendation(gap("AVAILABILITY_BATCH")));
    expect(configOverrideFrom(rec.templateConfig).fields).toBeUndefined();
  });
});
