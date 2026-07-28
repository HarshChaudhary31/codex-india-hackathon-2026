import type { FileDiff } from "@/lib/agent/types";

function buildUnifiedDiff(path: string, before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const header = [`--- a/${path}`, `+++ b/${path}`, "@@ fix @@"];
  const removed = beforeLines.map((line) => `-${line}`);
  const added = afterLines.map((line) => `+${line}`);

  return [...header, ...removed, ...added].join("\n");
}

export function buildDiffs(
  originalFiles: Record<string, string>,
  updatedFiles: Record<string, string>,
): FileDiff[] {
  const diffs: FileDiff[] = [];

  for (const [filePath, before] of Object.entries(originalFiles)) {
    const after = updatedFiles[filePath];
    if (after === undefined || before === after) {
      continue;
    }

    diffs.push({
      path: filePath,
      before,
      after,
      unified: buildUnifiedDiff(filePath, before, after),
    });
  }

  return diffs;
}
