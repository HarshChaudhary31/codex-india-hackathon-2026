import { describe, expect, it } from "vitest";

import { OffByOneRepairProvider } from "@/lib/agent/off-by-one-provider";
import { runRepairWorkflow } from "@/lib/agent/orchestrator";
import {
  createIsolatedWorkspace,
  destroyWorkspace,
  loadScenarioDefinition,
} from "@/lib/sandbox/workspace";
import { runTestsInWorkspace } from "@/lib/tools/run-tests";

describe("off-by-one scenario infrastructure", () => {
  it("loads a real scenario with broken source and failing tests", async () => {
    const scenario = await loadScenarioDefinition("off-by-one");
    expect(scenario.sourceFiles).toContain("src/sumArray.ts");

    const snapshot = await createIsolatedWorkspace("off-by-one");
    try {
      const initial = await runTestsInWorkspace(snapshot.rootPath);
      expect(initial.success).toBe(false);
      expect(initial.summary.failed).toBeGreaterThan(0);
    } finally {
      await destroyWorkspace(snapshot);
    }
  });
});

describe("off-by-one repair workflow", () => {
  it("runs RED → patch → GREEN with real events and diff", async () => {
    const result = await runRepairWorkflow({
      scenarioId: "off-by-one",
      provider: new OffByOneRepairProvider(),
    });

    expect(result.success).toBe(true);
    expect(result.initialTestResult.success).toBe(false);
    expect(result.finalTestResult?.success).toBe(true);
    expect(result.finalTestResult?.summary.failed).toBe(0);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0]?.path).toBe("src/sumArray.ts");
    expect(result.diffs[0]?.before).toContain("<= values.length");
    expect(result.diffs[0]?.after).toContain("< values.length");
    expect(result.plan?.rootCause).toContain("<=");

    const eventTypes = result.events.map((event) => event.type);
    expect(eventTypes).toContain("test_result");
    expect(eventTypes).toContain("plan");
    expect(eventTypes).toContain("tool_call");
    expect(eventTypes).toContain("self_review");
    expect(eventTypes).toContain("complete");

    const phases = result.events.map((event) => event.phase);
    expect(phases).toContain("understanding");
    expect(phases).toContain("planning");
    expect(phases).toContain("executing");
    expect(phases).toContain("validating");
    expect(phases).toContain("self_review");
    expect(phases).toContain("complete");
  });
});
