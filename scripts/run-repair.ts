#!/usr/bin/env node
import { OffByOneRepairProvider } from "../lib/agent/off-by-one-provider";
import { OpenAIRepairProvider } from "../lib/agent/openai-provider";
import { runRepairWorkflow } from "../lib/agent/orchestrator";

async function main() {
  const scenarioId = process.argv[2] ?? "off-by-one";
  const useOpenAI = process.argv.includes("--openai");

  const provider = useOpenAI ? new OpenAIRepairProvider() : new OffByOneRepairProvider();

  const result = await runRepairWorkflow({
    scenarioId,
    provider,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
