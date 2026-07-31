"use client";

import { useCallback, useMemo, useState } from "react";

import type { AgentEvent, RepairRunResult } from "@/lib/agent/types";

type WorkflowStepId =
  | "validate"
  | "understand"
  | "plan"
  | "patch"
  | "retest"
  | "review"
  | "complete";

type StepStatus = "pending" | "active" | "done" | "error";

interface WorkflowStep {
  id: WorkflowStepId;
  label: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "validate", label: "Validate" },
  { id: "understand", label: "Understand" },
  { id: "plan", label: "Plan" },
  { id: "patch", label: "Patch" },
  { id: "retest", label: "Re-test" },
  { id: "review", label: "Review" },
  { id: "complete", label: "Complete" },
];

type SupportedLanguage = "typescript" | "python" | "cpp" | "c";

const EXAMPLES: Record<SupportedLanguage, string> = {
  typescript: `export function sumArray(values: number[]): number {
  let total = 0;
  for (let index = 0; index <= values.length; index += 1) {
    total += values[index];
  }
  return total;
}`,

  python: `def sum_array(values):
    total = 0
    for index in range(len(values) + 1):
        total += values[index]
    return total`,

  cpp: `#include <vector>
using namespace std;

int sumArray(const vector<int>& values) {
    int total = 0;
    for (size_t i = 0; i <= values.size(); ++i) {
        total += values[i];
    }
    return total;
}`,

  c: `int sumArray(const int values[], int length) {
    int total = 0;
    for (int i = 0; i <= length; ++i) {
        total += values[i];
    }
    return total;
}`,
};

function getStepStatuses(
  activeStepIndex: number,
  hasError: boolean,
): Record<WorkflowStepId, StepStatus> {
  const statuses = {} as Record<WorkflowStepId, StepStatus>;

  for (const [index, step] of WORKFLOW_STEPS.entries()) {
    if (hasError && index === activeStepIndex) {
      statuses[step.id] = "error";
    } else if (index < activeStepIndex || activeStepIndex >= WORKFLOW_STEPS.length) {
      statuses[step.id] = "done";
    } else if (index === activeStepIndex) {
      statuses[step.id] = "active";
    } else {
      statuses[step.id] = "pending";
    }
  }

  return statuses;
}

function findEvent(
  events: AgentEvent[],
  predicate: (event: AgentEvent) => boolean,
): AgentEvent | undefined {
  return events.find(predicate);
}

function DiffViewer({ before, after, path }: { before: string; after: string; path: string }) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-2 font-mono text-xs text-zinc-400">
        {path}
      </div>
      <div className="grid md:grid-cols-2">
        <div className="border-b border-zinc-800 md:border-b-0 md:border-r">
          <div className="border-b border-zinc-800/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400/90">
            Before
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {beforeLines.map((line, index) => (
              <div
                key={`before-${index}`}
                className={
                  line.includes("<= values.length")
                    ? "bg-red-500/15 text-red-200"
                    : "text-zinc-400"
                }
              >
                {line || " "}
              </div>
            ))}
          </pre>
        </div>
        <div>
          <div className="border-b border-zinc-800/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
            After
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {afterLines.map((line, index) => (
              <div
                key={`after-${index}`}
                className={
                  line.includes("< values.length")
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "text-zinc-300"
                }
              >
                {line || " "}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  label,
  status,
  index,
}: {
  label: string;
  status: StepStatus;
  index: number;
}) {
  const statusStyles: Record<StepStatus, string> = {
    pending: "border-zinc-700 bg-zinc-900 text-zinc-500",
    active: "border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-500/30",
    done: "border-emerald-600/50 bg-emerald-500/20 text-emerald-300",
    error: "border-red-500 bg-red-500/10 text-red-300 ring-2 ring-red-500/30",
  };

  return (
    <div className="flex flex-col items-center gap-2 min-w-[4.5rem]">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 ${statusStyles[status]}`}
      >
        {status === "done" ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : status === "error" ? (
          "!"
        ) : (
          index + 1
        )}
      </div>
      <span
        className={`text-center text-[11px] font-medium leading-tight ${
          status === "pending" ? "text-zinc-600" : "text-zinc-300"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function TestBadge({
  passed,
  failed,
  total,
  variant,
}: {
  passed: number;
  failed: number;
  total: number;
  variant: "red" | "green" | "neutral";
}) {
  const styles = {
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    neutral: "border-zinc-700 bg-zinc-900 text-zinc-400",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${styles[variant]}`}>
      <span
        className={`h-2 w-2 rounded-full ${
          variant === "red" ? "bg-red-400" : variant === "green" ? "bg-emerald-400" : "bg-zinc-500"
        }`}
      />
      {failed > 0 ? (
        <span>{failed} failed</span>
      ) : passed > 0 ? (
        <span>{passed} passed</span>
      ) : (
        <span>{total} tests</span>
      )}
      {total > 0 && (
        <span className="text-xs opacity-70">/ {total} total</span>
      )}
    </div>
  );
}

export function GreenLoopDashboard() {
  const [running, setRunning] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [result, setResult] = useState<RepairRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
const [language, setLanguage] =
  useState<SupportedLanguage>("typescript");

const [sourceCode, setSourceCode] =
  useState(EXAMPLES.typescript);
 

  const stepStatuses = useMemo(
    () => getStepStatuses(activeStepIndex, Boolean(error)),
    [activeStepIndex, error],
  );

  const animateWorkflow = useCallback(async () => {
    const delays = [400, 600, 500, 700, 800, 600, 400];

    for (let index = 0; index < WORKFLOW_STEPS.length; index += 1) {
      setActiveStepIndex(index);
      await new Promise((resolve) => setTimeout(resolve, delays[index] ?? 500));
    }

    setActiveStepIndex(WORKFLOW_STEPS.length);
  }, []);

  const runRepair = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setActiveStepIndex(0);

    try {
      const response = await fetch("/api/repair", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  mode: "ai",
  sourceCode,
  language,
}),
});
      const data = (await response.json()) as RepairRunResult & { error?: string };

if (!response.ok) {
  throw new Error(data.error ?? "Repair request failed.");
}

// Keep failed workflow results so the UI can show
// initial tests, attempted repair, and final test state.
setResult(data);
await animateWorkflow();

if (!data.success) {
  setError(data.error ?? "Repair workflow did not succeed.");
}
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during repair.";
      setError(message);
    } finally {
      setRunning(false);
    }
    }, [animateWorkflow, sourceCode, language]);

  const initialTest = result?.initialTestResult;
  const finalTest = result?.finalTestResult;
  const plan = result?.plan;
  const diff = result?.diffs[0];
  const selfReview = result?.selfReview;

  const understandingEvent = result
    ? findEvent(result.events, (event) => event.type === "understanding")
    : undefined;

  const showRed = activeStepIndex >= 0 && result?.initialTestResult;
  const showGreen = activeStepIndex >= 4 && finalTest?.success;
  const showPlan = activeStepIndex >= 2 && plan;
  const showDiff = activeStepIndex >= 3 && diff;
  const showReview = activeStepIndex >= 5 && selfReview;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">GreenLoop</h1>
                <p className="text-sm text-zinc-400">Autonomous test-driven code repair</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Agent Ready
            </span>
            <span className="hidden text-xs text-zinc-500 sm:inline">Codex India Hackathon 2026</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                Scenario
              </div>
              <h2 className="text-lg font-semibold text-white">Off-by-One Bug</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
                  sumArray
                </code>{" "}
                uses{" "}
                <code className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-xs text-red-300">
                  &lt;=
                </code>{" "}
                instead of{" "}
                <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                  &lt;
                </code>{" "}
                in the loop bound, causing undefined access and wrong totals.
              </p>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
  <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
      Your Code
    </span>

    <span className="font-mono text-[10px] text-zinc-600">
      src/sumArray.ts
    </span>
  </div>
<div className="mb-3">
  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
    Language
  </label>

  <select
    value={language}
    onChange={(event) => {
      const nextLanguage = event.target.value as SupportedLanguage;
      setLanguage(nextLanguage);
      setSourceCode(EXAMPLES[nextLanguage]);
      setResult(null);
      setError(null);
      setActiveStepIndex(-1);
    }}
    disabled={running}
    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
  >
    <option value="typescript">TypeScript</option>
    <option value="python">Python</option>
    <option value="cpp">C++</option>
    <option value="c">C</option>
  </select>
</div>

  <textarea
  value={sourceCode}
  onChange={(event) => {
    setSourceCode(event.target.value);
    setResult(null);
    setError(null);
    setActiveStepIndex(-1);
  }}
    disabled={running}
    spellCheck={false}
    aria-label="Source code to repair"
    className="min-h-[220px] w-full resize-y bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-700 focus:ring-1 focus:ring-inset focus:ring-emerald-500/50 disabled:opacity-60"
    placeholder="Paste your TypeScript code here..."
  />

  <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2">
    <span className="text-[10px] text-zinc-600">
      Edit the code and run the repair workflow
    </span>

    <button
      type="button"
      onClick={() => setSourceCode(EXAMPLES[language])}
      disabled={running}
      className="text-xs font-medium text-zinc-400 transition hover:text-white disabled:opacity-50"
    >
      Reset Example
    </button>
  </div>
</div>

              <button
                type="button"
                onClick={runRepair}
                disabled={running}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running repair workflow…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Repair
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Workflow
              </h3>
              <div className="relative">
                <div className="absolute left-0 right-0 top-[1.125rem] hidden h-px bg-zinc-800 sm:block" />
                <div className="flex flex-wrap justify-between gap-4 sm:gap-2">
                  {WORKFLOW_STEPS.map((step, index) => (
                    <StepIndicator
                      key={step.id}
                      label={step.label}
                      status={stepStatuses[step.id]}
                      index={index}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Initial State
                </div>
                {showRed && initialTest ? (
  <div className="space-y-2">
    <TestBadge
      passed={initialTest.summary.passed}
      failed={initialTest.summary.failed}
      total={initialTest.summary.total}
      variant={initialTest.success ? "green" : "red"}
    />

    <p
      className={`text-sm font-medium ${
        initialTest.success
          ? "text-emerald-300/90"
          : "text-red-300/90"
      }`}
    >
      {initialTest.success
        ? "GREEN — code already passes all tests"
        : "RED — tests failing"}
    </p>

    <p className="text-xs text-zinc-500">
      {initialTest.success
        ? `${initialTest.summary.passed} of ${initialTest.summary.total} tests passed`
        : `${initialTest.summary.failed} of ${initialTest.summary.total} tests failed`}
    </p>
  </div>
) : (
                  <p className="text-sm text-zinc-600">Run repair to validate failing tests</p>
                )}
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Final State
                </div>
                {showGreen && finalTest ? (
  initialTest?.success ? (
    <div className="space-y-2">
      <TestBadge
        passed={finalTest.summary.passed}
        failed={finalTest.summary.failed}
        total={finalTest.summary.total}
        variant="green"
      />

      <p className="text-sm font-medium text-emerald-300/90">
        No repair needed
      </p>

      <p className="text-xs text-zinc-500">
        Code was already correct.
      </p>
    </div>
  ) : (
    <div className="space-y-2">
      <TestBadge
        passed={finalTest.summary.passed}
        failed={finalTest.summary.failed}
        total={finalTest.summary.total}
        variant="green"
      />

      <p className="text-sm font-medium text-emerald-300/90">
        GREEN — all tests passing
      </p>

      <p className="text-xs text-zinc-500">
        {finalTest.summary.passed} of {finalTest.summary.total} tests passed
      </p>
    </div>
  )
) : (
  <p className="text-sm text-zinc-600">
    Awaiting patch &amp; re-test
  </p>
)}
                    
              </div>
            </div>

            {activeStepIndex >= 1 && understandingEvent && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Root Cause
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">
                  Loop bound uses{" "}
                  <code className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-xs text-red-300">
                    &lt;= values.length
                  </code>{" "}
                  — should be{" "}
                  <code className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                    &lt; values.length
                  </code>
                  .
                </p>
                <p className="mt-2 text-sm text-zinc-400">{understandingEvent.message}</p>
              </div>
            )}

            {showPlan && plan && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Repair Plan
                </div>
                <p className="text-sm font-medium text-white">{plan.summary}</p>
                <p className="mt-2 text-sm text-zinc-400">{plan.rootCause}</p>
                <ol className="mt-3 space-y-1.5">
                  {plan.steps.map((step, index) => (
                    <li key={index} className="flex gap-2 text-sm text-zinc-400">
                      <span className="font-mono text-xs text-emerald-500/80">{index + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {showDiff && diff && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Code Diff
                </div>
                <DiffViewer before={diff.before} after={diff.after} path={diff.path} />
              </div>
            )}

            {showReview && selfReview && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                    Self-Review
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    Confidence: {selfReview.confidence}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-200">{selfReview.summary}</p>
                {selfReview.caveats.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-emerald-500/10 pt-3">
                    {selfReview.caveats.map((caveat, index) => (
                      <li key={index} className="text-xs text-zinc-500">
                        {caveat}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
