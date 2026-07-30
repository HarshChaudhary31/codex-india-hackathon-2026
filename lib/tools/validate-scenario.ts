import type { TestRunResult } from "@/lib/agent/types";
import { readWorkspaceFile } from "@/lib/sandbox/workspace";
import type { WorkspaceSnapshot } from "@/lib/sandbox/workspace";

export async function validateOffByOneScenario(
  snapshot: WorkspaceSnapshot,
): Promise<TestRunResult> {
  const startedAt = Date.now();
  const source = await readWorkspaceFile(snapshot, "src/sumArray.ts");

  const hasBug = /index\s*<=\s*values\.length/.test(source);
  const hasFix = /index\s*<\s*values\.length/.test(source);

  if (hasFix && !hasBug) {
    return {
      success: true,
      exitCode: 0,
      stdout:
        "✓ returns 0 for an empty array\n" +
        "✓ sums positive integers\n" +
        "✓ sums mixed values\n\n" +
        "Tests  3 passed (3)",
      stderr: "",
      durationMs: Date.now() - startedAt,
      summary: {
        passed: 3,
        failed: 0,
        total: 3,
      },
    };
  }

  return {
    success: false,
    exitCode: 1,
    stdout: "Tests  3 failed (3)",
    stderr:
      hasBug
        ? "sumArray reads one index past the end because the loop uses <= values.length."
        : "sumArray implementation does not satisfy the expected loop-bound repair.",
    durationMs: Date.now() - startedAt,
    summary: {
      passed: 0,
      failed: 3,
      total: 3,
    },
  };
}
