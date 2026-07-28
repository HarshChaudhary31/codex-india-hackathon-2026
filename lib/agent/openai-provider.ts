import OpenAI from "openai";
import { z } from "zod";

import type {
  PatchProposal,
  RepairPlan,
  RepairProvider,
  ScenarioDefinition,
  SelfReviewResult,
  TestRunResult,
} from "@/lib/agent/types";

const planSchema = z.object({
  understanding: z.string(),
  summary: z.string(),
  rootCause: z.string(),
  steps: z.array(z.string()).min(1).max(8),
});

const patchSchema = z.object({
  path: z.string(),
  content: z.string(),
  rationale: z.string(),
});

const reviewSchema = z.object({
  summary: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  caveats: z.array(z.string()),
});

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

export class OpenAIRepairProvider implements RepairProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({
      apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
    });
    this.model = options?.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  }

  async understand(input: {
    scenario: ScenarioDefinition;
    testResult: TestRunResult;
    files: Record<string, string>;
  }): Promise<{ understanding: string; plan: RepairPlan }> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content:
            "You are GreenLoop's repair planner. Analyze failing tests and source files. Respond with JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Understand the failure and produce a repair plan.",
              scenario: input.scenario,
              testResult: {
                success: input.testResult.success,
                stdout: input.testResult.stdout,
                stderr: input.testResult.stderr,
                summary: input.testResult.summary,
              },
              files: input.files,
              responseShape: {
                understanding: "string",
                summary: "string",
                rootCause: "string",
                steps: ["string"],
              },
            },
            null,
            2,
          ),
        },
      ],
    });

    const text = response.output_text;
    const parsed = planSchema.parse(extractJsonObject(text));

    return {
      understanding: parsed.understanding,
      plan: {
        summary: parsed.summary,
        rootCause: parsed.rootCause,
        steps: parsed.steps,
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
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content:
            "You are GreenLoop's patch generator. Return JSON with a complete updated file. Do not omit unchanged code.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Generate one patch that should make tests pass.",
              scenario: input.scenario,
              plan: input.plan,
              latestTestResult: {
                stdout: input.testResult.stdout,
                stderr: input.testResult.stderr,
                summary: input.testResult.summary,
              },
              files: input.files,
              previousAttempts: input.previousAttempts,
              responseShape: {
                path: "relative/path.ts",
                content: "full file content",
                rationale: "string",
              },
            },
            null,
            2,
          ),
        },
      ],
    });

    return patchSchema.parse(extractJsonObject(response.output_text));
  }

  async selfReview(input: {
    scenario: ScenarioDefinition;
    plan: RepairPlan;
    patches: PatchProposal[];
    finalTestResult: TestRunResult;
    diffs: Array<{ path: string; unified: string }>;
  }): Promise<SelfReviewResult> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content:
            "You are GreenLoop's self-review agent. Summarize the verified repair. Respond with JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Review the completed repair after tests passed.",
              scenario: input.scenario,
              plan: input.plan,
              patches: input.patches.map((patch) => ({
                path: patch.path,
                rationale: patch.rationale,
              })),
              finalTestResult: input.finalTestResult.summary,
              diffs: input.diffs,
              responseShape: {
                summary: "string",
                confidence: "low|medium|high",
                caveats: ["string"],
              },
            },
            null,
            2,
          ),
        },
      ],
    });

    return reviewSchema.parse(extractJsonObject(response.output_text));
  }
}

export function getRuntimeModelLabel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}
