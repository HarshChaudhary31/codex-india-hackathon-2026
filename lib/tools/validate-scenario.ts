import type { TestRunResult } from "@/lib/agent/types";
import { readWorkspaceFile } from "@/lib/sandbox/workspace";
import type { WorkspaceSnapshot } from "@/lib/sandbox/workspace";

export async function validateOffByOneScenario(
  snapshot: WorkspaceSnapshot,
): Promise<TestRunResult> {
  const startedAt = Date.now();
  const source = await readWorkspaceFile(snapshot, "src/sumArray.ts");

  const tests = [
    {
      name: "returns 0 for an empty array",
      passed:
        /export\s+function\s+sumArray/.test(source) &&
        /let\s+total\s*=\s*0/.test(source) &&
        /return\s+total/.test(source),
    },
    {
      name: "sums positive integers",
      passed:
        /index\s*<\s*values\.length/.test(source) &&
        /total\s*\+=\s*values\s*\[\s*index\s*\]/.test(source),
    },
    {
      name: "sums mixed values",
      passed:
        /index\s*<\s*values\.length/.test(source) &&
        !/index\s*<=\s*values\.length/.test(source) &&
        /return\s+total/.test(source),
    },
  ];

  const passedTests = tests.filter((test) => test.passed);
  const failedTests = tests.filter((test) => !test.passed);

  const passed = passedTests.length;
  const failed = failedTests.length;
  const total = tests.length;

  const stdout = tests
    .map((test) => `${test.passed ? "✓" : "✗"} ${test.name}`)
    .join("\n");

  return {
    success: failed === 0,
    exitCode: failed === 0 ? 0 : 1,
    stdout:
      stdout +
      `\n\nTests  ${passed} passed | ${failed} failed (${total})`,
    stderr:
      failed === 0
        ? ""
        : "The current implementation does not satisfy all sumArray checks.",
    durationMs: Date.now() - startedAt,
    summary: {
      passed,
      failed,
      total,
    },
  };
}
