import { NextRequest, NextResponse } from "next/server";

import { OffByOneRepairProvider } from "@/lib/agent/off-by-one-provider";
import {
  getRuntimeModelLabel,
  OpenAIRepairProvider,
} from "@/lib/agent/openai-provider";
import { runRepairWorkflow } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEMO_SCENARIO_ID = "off-by-one";

export async function POST(request: NextRequest) {
  try {
    let mode: "demo" | "ai" = "demo";

    try {
      const body = await request.json();

      if (body?.mode === "ai") {
        mode = "ai";
      }
    } catch {
      // No JSON body means use the safe deterministic demo.
    }

    if (mode === "ai" && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const provider =
      mode === "ai"
        ? new OpenAIRepairProvider()
        : new OffByOneRepairProvider();

    const result = await runRepairWorkflow({
  scenarioId: DEMO_SCENARIO_ID,
  provider,
  runtimeValidation: true,
});

    return NextResponse.json({
      ...result,
      provider: mode === "ai" ? "openai" : "deterministic",
      model: mode === "ai" ? getRuntimeModelLabel() : null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Repair workflow failed unexpectedly.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: "GreenLoop Repair API",
    scenario: DEMO_SCENARIO_ID,
    modes: ["demo", "ai"],
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
  });
}
