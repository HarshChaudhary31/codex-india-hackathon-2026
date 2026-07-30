import { spawn } from "node:child_process";
import path from "node:path";

import type { TestRunResult } from "@/lib/agent/types";
import { TEST_TIMEOUT_MS, truncateOutput } from "@/lib/security/limits";

const ALLOWED_COMMAND = "vitest";
const RUNNER_CONFIG = path.join(process.cwd(), "lib/sandbox/vitest-runner.config.ts");



function parseVitestSummary(output: string): TestRunResult["summary"] {
  // Remove ANSI terminal color/control codes from Vitest output.
  const cleanOutput = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");

  let passed = 0;
  let failed = 0;
  let total = 0;

  for (const line of cleanOutput.split(/\r?\n/)) {
    // Parse only the "Tests" summary, never "Test Files".
    if (!/^\s*Tests\s+/i.test(line)) {
      continue;
    }

    const passMatch = line.match(/(\d+)\s+passed/i);
    const failMatch = line.match(/(\d+)\s+failed/i);
    const totalMatch = line.match(/\((\d+)\)\s*$/);

    passed = passMatch ? Number(passMatch[1]) : 0;
    failed = failMatch ? Number(failMatch[1]) : 0;
    total = totalMatch ? Number(totalMatch[1]) : passed + failed;

    break;
  }

  return {
    passed,
    failed,
    total,
  };
}

export async function runTestsInWorkspace(workspaceRoot: string): Promise<TestRunResult> {
  const vitestEntry = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
  const startedAt = Date.now();

  return new Promise<TestRunResult>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [vitestEntry, "run", "--config", RUNNER_CONFIG, "--root", workspaceRoot],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "test",
        },
      },
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TEST_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);

      const durationMs = Date.now() - startedAt;
      const combinedOutput = `${stdout}\n${stderr}`;
      const summary = parseVitestSummary(combinedOutput);
      const startupFailure =
        combinedOutput.includes("Startup Error") ||
        combinedOutput.includes("MODULE_NOT_FOUND") ||
        combinedOutput.includes("failed to load config");
      const success =
        !timedOut && !startupFailure && exitCode === 0 && summary.failed === 0 && summary.passed > 0;

      resolve({
        success,
        exitCode: timedOut ? 124 : exitCode ?? 1,
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(timedOut ? `${stderr}\nTest execution timed out.` : stderr),
        durationMs,
        summary,
      });
    });
  });
}

export function getAllowedTestCommand(): string {
  return ALLOWED_COMMAND;
}
