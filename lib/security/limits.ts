import path from "node:path";

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_FILE_BYTES = 256 * 1024;
export const TEST_TIMEOUT_MS = 30_000;
export const MAX_RETRIES = 3;

const ALLOWED_SCENARIO_IDS = new Set(["off-by-one", "async-await", "config-mock"]);

export function assertAllowedScenarioId(scenarioId: string): void {
  if (!ALLOWED_SCENARIO_IDS.has(scenarioId)) {
    throw new Error(`Scenario "${scenarioId}" is not allowlisted.`);
  }
}

export function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
  const normalizedRoot = path.resolve(workspaceRoot);
  const resolved = path.resolve(normalizedRoot, relativePath);

  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }

  return resolved;
}

export function assertRelativeFilePath(relativePath: string): void {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error(`Invalid relative path: ${relativePath}`);
  }
}

export function truncateOutput(output: string, maxBytes = MAX_INPUT_BYTES): string {
  if (Buffer.byteLength(output, "utf8") <= maxBytes) {
    return output;
  }

  return `${output.slice(0, maxBytes)}\n...[truncated]`;
}
