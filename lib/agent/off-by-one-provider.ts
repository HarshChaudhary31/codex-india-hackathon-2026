import type {
  PatchProposal,
  RepairPlan,
  RepairProvider,
  ScenarioDefinition,
  SelfReviewResult,
  TestRunResult,
} from "@/lib/agent/types";

export class OffByOneRepairProvider implements RepairProvider {
  async understand(_input: {
    scenario: ScenarioDefinition;
    testResult: TestRunResult;
    files: Record<string, string>;
  }): Promise<{ understanding: string; plan: RepairPlan }> {
    return {
      understanding:
        "sumArray iterates one index past the final element because the loop bound uses <= values.length.",
      plan: {
        summary: "Fix the off-by-one loop bound in sumArray.",
        rootCause: "The for-loop condition uses <= instead of <.",
        steps: [
          "Inspect src/sumArray.ts",
          "Change the loop bound to stop before values.length",
          "Run tests to confirm all cases pass",
        ],
      },
    };
  }

  async proposePatch(input: {
    scenario: ScenarioDefinition;
    plan: RepairPlan;
    testResult: TestRunResult;
    files: Record<string, string>;
    previousAttempts: PatchProposal[];
  }): Promise<PatchProposal> {
    const original = input.files["src/sumArray.ts"];

    if (!original) {
      throw new Error("Expected src/sumArray.ts in workspace.");
    }
    let content = original;

content = content
  .replace(/<=\s*values\.length/g, "< values.length")
  .replace(/<=\s*arr\.length/g, "< arr.length")
  .replace(/<=\s*length/g, "< length")
  .replace(/<=\s*values\.size\s*\(\s*\)/g, "< values.size()")
  .replace(
    /range\s*\(\s*len\s*\(\s*values\s*\)\s*\+\s*1\s*\)/g,
    "range(len(values))",
  );
  if (content === original) {
  // Fallback: replace any <= with <
  content = content.replace(/<=/g, "<");
}


    return {
      path: "src/sumArray.ts",
      content,
      rationale: "Use a strict upper bound so the loop never reads past the final index.",
    };
  }

  async selfReview(_input: {
    scenario: ScenarioDefinition;
    plan: RepairPlan;
    patches: PatchProposal[];
    finalTestResult: TestRunResult;
    diffs: Array<{ path: string; unified: string }>;
  }): Promise<SelfReviewResult> {
    return {
      summary:
        "The loop bound was corrected and all scenario tests passed in the isolated workspace.",
      confidence: "high",
      caveats: [
        "This deterministic provider is used in automated tests without an OpenAI API key.",
      ],
    };
  }
}
