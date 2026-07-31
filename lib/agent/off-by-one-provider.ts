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

if (/index\s*<=\s*values\.length/.test(content)) {
  content = content.replace(
    /index\s*<=\s*values\.length/,
    "index < values.length",
  );
} else if (/range\s*\(\s*len\s*\(\s*values\s*\)\s*\+\s*1\s*\)/.test(content)) {
  content = content.replace(
    /range\s*\(\s*len\s*\(\s*values\s*\)\s*\+\s*1\s*\)/,
    "range(len(values))",
  );
} else if (/i\s*<=\s*values\.size\s*\(\s*\)/.test(content)) {
  content = content.replace(
    /i\s*<=\s*values\.size\s*\(\s*\)/,
    "i < values.size()",
  );
} else if (/i\s*<=\s*length/.test(content)) {
  content = content.replace(
    /i\s*<=\s*length/,
    "i < length",
  );
} else {
  throw new Error(
    "No supported off-by-one loop pattern was found.",
  );
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
