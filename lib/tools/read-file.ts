import type { WorkspaceSnapshot } from "@/lib/sandbox/workspace";
import { readWorkspaceFile } from "@/lib/sandbox/workspace";

export async function readFileTool(
  snapshot: WorkspaceSnapshot,
  relativePath: string,
): Promise<{ path: string; content: string }> {
  const content = await readWorkspaceFile(snapshot, relativePath);
  return { path: relativePath, content };
}
