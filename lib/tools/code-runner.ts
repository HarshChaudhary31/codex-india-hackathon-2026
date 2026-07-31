import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { TestRunResult } from "@/lib/agent/types";

const execFileAsync = promisify(execFile);

export type SupportedLanguage =
  | "typescript"
  | "python"
  | "cpp"
  | "c";

const FILE_NAMES: Record<SupportedLanguage, string> = {
  typescript: "main.ts",
  python: "main.py",
  cpp: "main.cpp",
  c: "main.c",
};

function result(
  startedAt: number,
  success: boolean,
  stdout: string,
  stderr: string,
  exitCode: number,
): TestRunResult {
  return {
    success,
    exitCode,
    stdout,
    stderr,
    durationMs: Date.now() - startedAt,
    summary: {
      passed: success ? 1 : 0,
      failed: success ? 0 : 1,
      total: 1,
    },
  };
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const processError = error as Error & {
    stdout?: string;
    stderr?: string;
    code?: number | string;
  };

  return [
    processError.message,
    processError.stdout,
    processError.stderr,
  ]
    .filter(Boolean)
    .join("\n");
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
  env: process.env,
});
}

export async function runUserCode(
  language: SupportedLanguage,
  sourceCode: string,
): Promise<TestRunResult> {
  const startedAt = Date.now();
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "greenloop-run-"),
  );

  try {
    const sourceFile = path.join(
      tempDir,
      FILE_NAMES[language],
    );

    await writeFile(sourceFile, sourceCode, "utf8");

    switch (language) {
      case "python": {
        try {
          const { stdout, stderr } = await execute(
            "python3",
            [sourceFile],
            tempDir,
          );

          return result(
            startedAt,
            true,
            stdout || "Program executed successfully.",
            stderr,
            0,
          );
        } catch (error) {
          return result(
            startedAt,
            false,
            "",
            errorMessage(error),
            1,
          );
        }
      }

      case "c": {
        const binary = path.join(tempDir, "program");

        try {
          await execute(
            "clang",
            [
              "-std=c11",
              "-Wall",
              "-Wextra",
              sourceFile,
              "-o",
              binary,
            ],
            tempDir,
          );

          const { stdout, stderr } = await execute(
            binary,
            [],
            tempDir,
          );

          return result(
            startedAt,
            true,
            stdout || "Program compiled and executed successfully.",
            stderr,
            0,
          );
        } catch (error) {
          return result(
            startedAt,
            false,
            "",
            errorMessage(error),
            1,
          );
        }
      }

      case "cpp": {
        const binary = path.join(tempDir, "program");

        try {
          await execute(
            "clang++",
            [
              "-std=c++17",
              "-Wall",
              "-Wextra",
              sourceFile,
              "-o",
              binary,
            ],
            tempDir,
          );

          const { stdout, stderr } = await execute(
            binary,
            [],
            tempDir,
          );

          return result(
            startedAt,
            true,
            stdout || "Program compiled and executed successfully.",
            stderr,
            0,
          );
        } catch (error) {
          return result(
            startedAt,
            false,
            "",
            errorMessage(error),
            1,
          );
        }
      }

      case "typescript": {
        try {
          const tsxBinary = path.join(
            process.cwd(),
            "node_modules",
            ".bin",
            "tsx",
          );

          const { stdout, stderr } = await execute(
            tsxBinary,
            [sourceFile],
            tempDir,
          );

          return result(
            startedAt,
            true,
            stdout || "Program executed successfully.",
            stderr,
            0,
          );
        } catch (error) {
          return result(
            startedAt,
            false,
            "",
            errorMessage(error),
            1,
          );
        }
      }
    }
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}
