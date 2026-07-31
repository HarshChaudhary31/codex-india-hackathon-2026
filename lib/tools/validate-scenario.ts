import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { TestRunResult } from "@/lib/agent/types";
import { readWorkspaceFile } from "@/lib/sandbox/workspace";
import type { WorkspaceSnapshot } from "@/lib/sandbox/workspace";

const execFileAsync = promisify(execFile);

export type SupportedLanguage =
  | "typescript"
  | "python"
  | "cpp"
  | "c";

interface TestCase {
  name: string;
  expected: number;
}

const TEST_CASES: TestCase[] = [
  { name: "empty array", expected: 0 },
  { name: "positive integers", expected: 10 },
  { name: "mixed values", expected: 3 },
  { name: "single value", expected: 42 },
  { name: "zero values", expected: 0 },
];

function createResult(
  startedAt: number,
  results: Array<{ name: string; passed: boolean; detail?: string }>,
  stderr = "",
): TestRunResult {
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  const stdout = results
    .map(
      (result) =>
        `${result.passed ? "✓" : "✗"} ${result.name}${
          result.detail ? ` — ${result.detail}` : ""
        }`,
    )
    .join("\n");

  return {
    success: failed === 0,
    exitCode: failed === 0 ? 0 : 1,
    stdout:
      stdout +
      `\n\nTests  ${passed} passed | ${failed} failed (${results.length})`,
    stderr,
    durationMs: Date.now() - startedAt,
    summary: {
      passed,
      failed,
      total: results.length,
    },
  };
}

function failureResult(
  startedAt: number,
  message: string,
): TestRunResult {
  return {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr: message,
    durationMs: Date.now() - startedAt,
    summary: {
      passed: 0,
      failed: TEST_CASES.length,
      total: TEST_CASES.length,
    },
  };
}

async function execute(
  command: string,
  args: string[],
  cwd: string,
) {
  return execFileAsync(command, args, {
    cwd,
    timeout: 3000,
    maxBuffer: 1024 * 1024,
  });
}

function parseResults(output: string) {
  const lines = output.trim().split(/\r?\n/);

  return TEST_CASES.map((test, index) => {
    const value = Number(lines[index]);

    return {
      name: test.name,
      passed:
        Number.isFinite(value) &&
        value === test.expected,
      detail: Number.isFinite(value)
        ? `expected ${test.expected}, received ${value}`
        : "no valid numeric result",
    };
  });
}

async function validatePython(
  snapshot: WorkspaceSnapshot,
  source: string,
  startedAt: number,
) {
  const file = path.join(snapshot.rootPath, "__greenloop_test.py");

  const harness = `
${source}

cases = [
    [],
    [1, 2, 3, 4],
    [-5, 10, -2],
    [42],
    [0, 0, 0],
]

for values in cases:
    print(sum_array(values))
`;

  await writeFile(file, harness, "utf8");

  try {
    const { stdout } = await execute(
      "python3",
      [file],
      snapshot.rootPath,
    );

    return createResult(
      startedAt,
      parseResults(stdout),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    return failureResult(
      startedAt,
      `Python execution failed:\n${message}`,
    );
  }
}

async function validateCpp(
  snapshot: WorkspaceSnapshot,
  source: string,
  startedAt: number,
) {
  const sourceFile = path.join(
    snapshot.rootPath,
    "__greenloop_test.cpp",
  );

  const binary = path.join(
    snapshot.rootPath,
    "__greenloop_cpp",
  );

  const harness = `
#include <iostream>
#include <vector>
${source}

int main() {
    std::vector<std::vector<int>> cases = {
        {},
        {1, 2, 3, 4},
        {-5, 10, -2},
        {42},
        {0, 0, 0}
    };

    for (const auto& values : cases) {
        std::cout << sumArray(values) << "\\n";
    }

    return 0;
}
`;

  await writeFile(sourceFile, harness, "utf8");

  try {
    await execute(
      "clang++",
      [
        "-std=c++17",
        sourceFile,
        "-o",
        binary,
      ],
      snapshot.rootPath,
    );

    const { stdout } = await execute(
      binary,
      [],
      snapshot.rootPath,
    );

    return createResult(
      startedAt,
      parseResults(stdout),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    return failureResult(
      startedAt,
      `C++ compilation/execution failed:\n${message}`,
    );
  }
}

async function validateC(
  snapshot: WorkspaceSnapshot,
  source: string,
  startedAt: number,
) {
  const sourceFile = path.join(
    snapshot.rootPath,
    "__greenloop_test.c",
  );

  const binary = path.join(
    snapshot.rootPath,
    "__greenloop_c",
  );

  const harness = `
#include <stdio.h>
${source}

int main(void) {
    int empty[] = {0};
    int a[] = {1, 2, 3, 4};
    int b[] = {-5, 10, -2};
    int c[] = {42};
    int d[] = {0, 0, 0};

    printf("%d\\n", sumArray(empty, 0));
    printf("%d\\n", sumArray(a, 4));
    printf("%d\\n", sumArray(b, 3));
    printf("%d\\n", sumArray(c, 1));
    printf("%d\\n", sumArray(d, 3));

    return 0;
}
`;

  await writeFile(sourceFile, harness, "utf8");

  try {
    await execute(
      "clang",
      [
        "-std=c11",
        sourceFile,
        "-o",
        binary,
      ],
      snapshot.rootPath,
    );

    const { stdout } = await execute(
      binary,
      [],
      snapshot.rootPath,
    );

    return createResult(
      startedAt,
      parseResults(stdout),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    return failureResult(
      startedAt,
      `C compilation/execution failed:\n${message}`,
    );
  }
}

async function validateTypeScript(
  snapshot: WorkspaceSnapshot,
  source: string,
  startedAt: number,
) {
  const file = path.join(
    snapshot.rootPath,
    "__greenloop_test.ts",
  );

  const harness = `
${source}

const cases: number[][] = [
  [],
  [1, 2, 3, 4],
  [-5, 10, -2],
  [42],
  [0, 0, 0],
];

for (const values of cases) {
  console.log(sumArray(values));
}
`;

  await writeFile(file, harness, "utf8");

  try {
    const tsxBin = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      "tsx",
    );

    const { stdout } = await execute(
      tsxBin,
      [file],
      snapshot.rootPath,
    );

    return createResult(
      startedAt,
      parseResults(stdout),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    return failureResult(
      startedAt,
      `TypeScript execution failed:\n${message}`,
    );
  }
}

export async function validateOffByOneScenario(
  snapshot: WorkspaceSnapshot,
  language: SupportedLanguage = "typescript",
): Promise<TestRunResult> {
  const startedAt = Date.now();

  const source = await readWorkspaceFile(
    snapshot,
    "src/sumArray.ts",
  );

  switch (language) {
    case "python":
      return validatePython(snapshot, source, startedAt);

    case "cpp":
      return validateCpp(snapshot, source, startedAt);

    case "c":
      return validateC(snapshot, source, startedAt);

    case "typescript":
    default:
      return validateTypeScript(snapshot, source, startedAt);
  }
}
