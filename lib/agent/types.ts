export type AgentPhase =
  | "idle"
  | "understanding"
  | "planning"
  | "executing"
  | "validating"
  | "retrying"
  | "self_review"
  | "complete"
  | "failed";

export type AgentEventType =
  | "phase_changed"
  | "understanding"
  | "plan"
  | "tool_call"
  | "tool_result"
  | "test_result"
  | "retry"
  | "self_review"
  | "diff"
  | "error"
  | "complete";

export interface AgentEvent {
  id: string;
  runId: string;
  timestamp: string;
  type: AgentEventType;
  phase: AgentPhase;
  message: string;
  data?: Record<string, unknown>;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  entryTestFile: string;
  sourceFiles: string[];
}

export interface TestRunResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  summary: {
    passed: number;
    failed: number;
    total: number;
  };
}

export interface FileDiff {
  path: string;
  before: string;
  after: string;
  unified: string;
}

export interface RepairPlan {
  summary: string;
  rootCause: string;
  steps: string[];
}

export interface PatchProposal {
  path: string;
  content: string;
  rationale: string;
}

export interface SelfReviewResult {
  summary: string;
  confidence: "low" | "medium" | "high";
  caveats: string[];
}

export interface RepairRunResult {
  runId: string;
  scenarioId: string;
  phase: AgentPhase;
  success: boolean;
  initialTestResult: TestRunResult;
  finalTestResult: TestRunResult | null;
  plan: RepairPlan | null;
  patches: PatchProposal[];
  diffs: FileDiff[];
  selfReview: SelfReviewResult | null;
  retryCount: number;
  events: AgentEvent[];
  error?: string;
}

export interface RepairProvider {
  understand(input: {
    scenario: ScenarioDefinition;
    testResult: TestRunResult;
    files: Record<string, string>;
  }): Promise<{ understanding: string; plan: RepairPlan }>;

  proposePatch(input: {
    scenario: ScenarioDefinition;
    plan: RepairPlan;
    testResult: TestRunResult;
    files: Record<string, string>;
    previousAttempts: PatchProposal[];
  }): Promise<PatchProposal>;

  selfReview(input: {
    scenario: ScenarioDefinition;
    plan: RepairPlan;
    patches: PatchProposal[];
    finalTestResult: TestRunResult;
    diffs: FileDiff[];
  }): Promise<SelfReviewResult>;
}
