import { randomUUID } from "node:crypto";

import { AgentEventBus } from "@/lib/agent/event-bus";
import type {
  AgentPhase,
  PatchProposal,
  RepairProvider,
  RepairRunResult,
} from "@/lib/agent/types";
import { buildDiffs } from "@/lib/diff/build-diffs";
import { assertAllowedScenarioId, MAX_RETRIES } from "@/lib/security/limits";
import {
  createIsolatedWorkspace,
  destroyWorkspace,
  loadScenarioDefinition,
  readScenarioSourceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "@/lib/sandbox/workspace";
import { readFileTool } from "@/lib/tools/read-file";
import { runTestsInWorkspace } from "@/lib/tools/run-tests";
import { validateOffByOneScenario } from "@/lib/tools/validate-scenario";
import {
  runUserCode,
  type SupportedLanguage,
} from "@/lib/tools/code-runner";
import { writePatchTool } from "@/lib/tools/write-patch";

function setPhase(
  bus: AgentEventBus,
  phase: AgentPhase,
  message: string,
): AgentPhase {
  bus.emit("phase_changed", phase, message);
  return phase;
}

export async function runRepairWorkflow(options: {
  scenarioId: string;
  provider: RepairProvider;
  runId?: string;
  runtimeValidation?: boolean;
  sourceCode?: string;
  language?: SupportedLanguage;
}): Promise<RepairRunResult> {
  assertAllowedScenarioId(options.scenarioId);

  const runId: string = options.runId ?? randomUUID();
  const bus = new AgentEventBus(runId);
  let phase: AgentPhase = "idle";

  const snapshot = await createIsolatedWorkspace(
    options.scenarioId,
    runId,
  );

  if (options.sourceCode !== undefined) {
    await writeWorkspaceFile(
      snapshot,
      "src/sumArray.ts",
      options.sourceCode,
    );

    snapshot.originalFiles["src/sumArray.ts"] = options.sourceCode;
  }

  const runValidation = async () => {
  if (!options.runtimeValidation) {
    return runTestsInWorkspace(snapshot.rootPath);
  }

  const code = await readWorkspaceFile(
    snapshot,
    "src/sumArray.ts",
  );

  return runUserCode(
    options.language ?? "typescript",
    code,
  );
};

  const scenario = await loadScenarioDefinition(options.scenarioId);
  const patches: PatchProposal[] = [];
  let retryCount = 0;
  let plan = null;
  let selfReview = null;
  let finalTestResult = null;

  try {
  phase = setPhase(bus, "validating", "Running initial tests to confirm failure.");
  const initialTestResult = await runValidation();
    bus.emit("test_result", phase, "Initial test run completed.", {
      success: initialTestResult.success,
      exitCode: initialTestResult.exitCode,
      summary: initialTestResult.summary,
      stdout: initialTestResult.stdout,
      stderr: initialTestResult.stderr,
      label: "initial",
    });

    if (initialTestResult.success) {
  phase = setPhase(
    bus,
    "complete",
    "Code already passes all tests. No repair needed.",
  );

  bus.emit(
    "complete",
    phase,
    "All tests already pass. No repair was required.",
    {
      retryCount: 0,
      summary: initialTestResult.summary,
    },
  );

  return {
    runId,
    scenarioId: options.scenarioId,
    phase,
    success: true,
    initialTestResult,
    finalTestResult: initialTestResult,
    plan: null,
    patches: [],
    diffs: [],
    selfReview: null,
    retryCount: 0,
    events: bus.list(),
  };
}

    if (
      initialTestResult.stderr.includes("Startup Error") ||
      initialTestResult.stderr.includes("MODULE_NOT_FOUND")
    ) {
      throw new Error(`Test runner failed to start: ${initialTestResult.stderr}`);
    }

    phase = setPhase(bus, "understanding", "Analyzing failure output and source files.");
    const files = await readScenarioSourceFiles(snapshot, scenario);

    for (const relativePath of scenario.sourceFiles) {
      bus.emit("tool_call", phase, `Reading ${relativePath}`, {
        tool: "read_file",
        path: relativePath,
      });
      const file = await readFileTool(snapshot, relativePath);
      bus.emit("tool_result", phase, `Loaded ${relativePath}`, {
        tool: "read_file",
        path: file.path,
        bytes: Buffer.byteLength(file.content, "utf8"),
      });
    }

    const understandingResult = await options.provider.understand({
      scenario,
      testResult: initialTestResult,
      files,
    });

    bus.emit("understanding", phase, understandingResult.understanding, {
      understanding: understandingResult.understanding,
    });

    phase = setPhase(bus, "planning", "Creating repair plan.");
    plan = understandingResult.plan;
    bus.emit("plan", phase, plan.summary, {
      rootCause: plan.rootCause,
      steps: plan.steps,
    });

    let latestTestResult = initialTestResult;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
      phase = setPhase(
        bus,
        attempt === 0 ? "executing" : "retrying",
        attempt === 0
          ? "Generating patch for the failing code."
          : `Retry attempt ${attempt} after failed validation.`,
      );

      if (attempt > 0) {
        bus.emit("retry", phase, `Retry ${attempt} triggered by failing tests.`, {
          attempt,
          previousSummary: latestTestResult.summary,
        });
      }

      const currentFiles = await readScenarioSourceFiles(snapshot, scenario);
      const patch = await options.provider.proposePatch({
        scenario,
        plan,
        testResult: latestTestResult,
        files: currentFiles,
        previousAttempts: patches,
      });

      patches.push(patch);
      bus.emit("tool_call", phase, `Writing patch to ${patch.path}`, {
        tool: "write_patch",
        path: patch.path,
        rationale: patch.rationale,
      });

      const writeResult = await writePatchTool(snapshot, patch);
      bus.emit("tool_result", phase, `Updated ${writeResult.path}`, {
        tool: "write_patch",
        path: writeResult.path,
        bytesWritten: writeResult.bytesWritten,
      });

      phase = setPhase(bus, "validating", "Running tests after patch.");
      bus.emit("tool_call", phase, "Running allowlisted Vitest command.", {
        tool: "run_tests",
        command: "vitest run",
      });

      latestTestResult = await runValidation();
      bus.emit("tool_result", phase, "Test run finished.", {
        tool: "run_tests",
        success: latestTestResult.success,
        summary: latestTestResult.summary,
      });
      bus.emit("test_result", phase, "Post-patch test run completed.", {
        success: latestTestResult.success,
        exitCode: latestTestResult.exitCode,
        summary: latestTestResult.summary,
        stdout: latestTestResult.stdout,
        stderr: latestTestResult.stderr,
        label: attempt === 0 ? "after_patch" : `retry_${attempt}`,
      });

      if (latestTestResult.success) {
        finalTestResult = latestTestResult;
        break;
      }

      if (attempt >= MAX_RETRIES) {
        retryCount = attempt;
        phase = setPhase(bus, "failed", "Maximum retry attempts exhausted.");
        bus.emit("error", phase, "Repair workflow failed after max retries.", {
          retryCount,
        });

        return {
          runId,
          scenarioId: options.scenarioId,
          phase,
          success: false,
          initialTestResult,
          finalTestResult: latestTestResult,
          plan,
          patches,
          diffs: buildDiffs(
            snapshot.originalFiles,
            await readScenarioSourceFiles(snapshot, scenario),
          ),
          selfReview: null,
          retryCount,
          events: bus.list(),
          error: "Tests still failing after maximum retries.",
        };
      }

      retryCount = attempt + 1;
      attempt += 1;
    }

    if (!finalTestResult || !plan) {
      throw new Error("Repair workflow ended without a passing test result.");
    }

    const updatedFiles = await readScenarioSourceFiles(snapshot, scenario);
    const diffs = buildDiffs(snapshot.originalFiles, updatedFiles);
    bus.emit("diff", phase, "Generated diff for modified files.", {
      files: diffs.map((diff) => diff.path),
    });

    phase = setPhase(bus, "self_review", "Reviewing verified repair.");
    selfReview = await options.provider.selfReview({
      scenario,
      plan,
      patches,
      finalTestResult,
      diffs,
    });

    bus.emit("self_review", phase, selfReview.summary, {
      confidence: selfReview.confidence,
      caveats: selfReview.caveats,
    });

    phase = setPhase(bus, "complete", "Repair workflow completed successfully.");
    bus.emit("complete", phase, "All tests passed.", {
      retryCount,
      summary: finalTestResult.summary,
    });

    return {
      runId,
      scenarioId: options.scenarioId,
      phase,
      success: true,
      initialTestResult,
      finalTestResult,
      plan,
      patches,
      diffs,
      selfReview,
      retryCount,
      events: bus.list(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown repair workflow error.";
    phase = setPhase(bus, "failed", message);
    bus.emit("error", phase, message);

    return {
      runId,
      scenarioId: options.scenarioId,
      phase,
      success: false,
      initialTestResult: {
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: message,
        durationMs: 0,
        summary: { passed: 0, failed: 0, total: 0 },
      },
      finalTestResult: null,
      plan,
      patches,
      diffs: [],
      selfReview,
      retryCount,
      events: bus.list(),
      error: message,
    };
  } finally {
    await destroyWorkspace(snapshot);
  }
}
