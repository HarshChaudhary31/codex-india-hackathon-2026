import { NextResponse } from "next/server";

import { OffByOneRepairProvider } from "@/lib/agent/off-by-one-provider";
import { runRepairWorkflow } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEMO_SCENARIO_ID = "off-by-one";

export async function POST() {
  try {
    const result = await runRepairWorkflow({
      scenarioId: DEMO_SCENARIO_ID,
      provider: new OffByOneRepairProvider(),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Repair workflow failed unexpectedly.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST to run the off-by-one repair demo." },
    { status: 405 },
  );
}
