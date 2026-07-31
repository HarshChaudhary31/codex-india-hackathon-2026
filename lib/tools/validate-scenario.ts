import type { TestRunResult } from "@/lib/agent/types";
import { readWorkspaceFile } from "@/lib/sandbox/workspace";
import type { WorkspaceSnapshot } from "@/lib/sandbox/workspace";

type SupportedLanguage = "typescript" | "python" | "cpp" | "c";

export async function validateOffByOneScenario(
  snapshot: WorkspaceSnapshot,
  language: SupportedLanguage = "typescript",
): Promise<TestRunResult> {
  const startedAt = Date.now();
  const source = await readWorkspaceFile(snapshot, "src/sumArray.ts");

  let structure = false;
  let correctLoop = false;
  let accumulation = false;
  let returnsTotal = false;

  switch (language) {
    case "python":
      structure =
        /def\s+sum_array\s*\(\s*values\s*\)\s*:/.test(source) &&
        /total\s*=\s*0/.test(source);

      correctLoop =
        /range\s*\(\s*len\s*\(\s*values\s*\)\s*\)/.test(source) &&
        !/range\s*\(\s*len\s*\(\s*values\s*\)\s*\+\s*1\s*\)/.test(source);

      accumulation =
        /total\s*\+=\s*values\s*\[\s*index\s*\]/.test(source);

      returnsTotal = /return\s+total/.test(source);
      break;

    case "cpp":
      structure =
        /sumArray\s*\(\s*const\s+vector<int>\s*&\s*values\s*\)/.test(source) &&
        /total\s*=\s*0/.test(source);

      correctLoop =
        /i\s*<\s*values\.size\s*\(\s*\)/.test(source) &&
        !/i\s*<=\s*values\.size\s*\(\s*\)/.test(source);

      accumulation =
        /total\s*\+=\s*values\s*\[\s*i\s*\]/.test(source);

      returnsTotal = /return\s+total/.test(source);
      break;

    case "c":
      structure =
        /sumArray\s*\(\s*const\s+int\s+values\s*\[\s*\]\s*,\s*int\s+length\s*\)/.test(source) &&
        /total\s*=\s*0/.test(source);

      correctLoop =
        /i\s*<\s*length/.test(source) &&
        !/i\s*<=\s*length/.test(source);

      accumulation =
        /total\s*\+=\s*values\s*\[\s*i\s*\]/.test(source);

      returnsTotal = /return\s+total/.test(source);
      break;

    case "typescript":
    default:
      structure =
        /export\s+function\s+sumArray/.test(source) &&
        /let\s+total\s*=\s*0/.test(source);

      correctLoop =
        /index\s*<\s*values\.length/.test(source) &&
        !/index\s*<=\s*values\.length/.test(source);

      accumulation =
        /total\s*\+=\s*values\s*\[\s*index\s*\]/.test(source);

      returnsTotal = /return\s+total/.test(source);
      break;
  }

  const tests = [
    {
      name: "creates sumArray and initializes total",
      passed: structure,
    },
    {
      name: "iterates only over valid array indexes",
      passed: correctLoop && accumulation,
    },
    {
      name: "returns the calculated total",
      passed: returnsTotal,
    },
  ];

  const passed = tests.filter((test) => test.passed).length;
  const failed = tests.length - passed;
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
        : `${language} implementation does not satisfy all sumArray checks.`,
    durationMs: Date.now() - startedAt,
    summary: {
      passed,
      failed,
      total,
    },
  };
}
