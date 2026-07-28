import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ScenarioDefinition } from "@/lib/agent/types";
import {
  assertRelativeFilePath,
  MAX_FILE_BYTES,
  resolveWorkspacePath,
} from "@/lib/security/limits";

export interface WorkspaceSnapshot {
  runId: string;
  scenarioId: string;
  rootPath: string;
  originalFiles: Record<string, string>;
}

export function getFixtureRoot(scenarioId: string): string {
  return path.join(process.cwd(), "fixtures", scenarioId);
}

export async function loadScenarioDefinition(
  scenarioId: string,
): Promise<ScenarioDefinition> {
  const scenarioPath = path.join(getFixtureRoot(scenarioId), "scenario.json");
  const raw = await readFile(scenarioPath, "utf8");
  return JSON.parse(raw) as ScenarioDefinition;
}

export async function createIsolatedWorkspace(
  scenarioId: string,
  runId: string = randomUUID(),
): Promise<WorkspaceSnapshot> {
  const fixtureWorkspace = path.join(getFixtureRoot(scenarioId), "workspace");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "greenloop-"));
  const workspaceRoot = path.join(tempRoot, runId);

  await cp(fixtureWorkspace, workspaceRoot, { recursive: true });

  const scenario = await loadScenarioDefinition(scenarioId);
  const originalFiles: Record<string, string> = {};

  for (const relativePath of scenario.sourceFiles) {
    assertRelativeFilePath(relativePath);
    const absolutePath = resolveWorkspacePath(workspaceRoot, relativePath);
    originalFiles[relativePath] = await readFile(absolutePath, "utf8");
  }

  return {
    runId,
    scenarioId,
    rootPath: workspaceRoot,
    originalFiles,
  };
}

export async function destroyWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  const parentDir = path.dirname(snapshot.rootPath);
  await rm(parentDir, { recursive: true, force: true });
}

export async function readWorkspaceFile(
  snapshot: WorkspaceSnapshot,
  relativePath: string,
): Promise<string> {
  assertRelativeFilePath(relativePath);
  const absolutePath = resolveWorkspacePath(snapshot.rootPath, relativePath);
  const content = await readFile(absolutePath, "utf8");

  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new Error(`File exceeds size limit: ${relativePath}`);
  }

  return content;
}

export async function writeWorkspaceFile(
  snapshot: WorkspaceSnapshot,
  relativePath: string,
  content: string,
): Promise<void> {
  assertRelativeFilePath(relativePath);

  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new Error(`Patch exceeds size limit: ${relativePath}`);
  }

  const absolutePath = resolveWorkspacePath(snapshot.rootPath, relativePath);
  await writeFile(absolutePath, content, "utf8");
}

export async function readScenarioSourceFiles(
  snapshot: WorkspaceSnapshot,
  scenario: ScenarioDefinition,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  for (const relativePath of scenario.sourceFiles) {
    files[relativePath] = await readWorkspaceFile(snapshot, relativePath);
  }

  return files;
}
