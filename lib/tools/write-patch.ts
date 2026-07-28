import type { PatchProposal } from "@/lib/agent/types";
import type { WorkspaceSnapshot } from "@/lib/sandbox/workspace";
import { writeWorkspaceFile } from "@/lib/sandbox/workspace";

export async function writePatchTool(
  snapshot: WorkspaceSnapshot,
  patch: PatchProposal,
): Promise<{ path: string; bytesWritten: number }> {
  await writeWorkspaceFile(snapshot, patch.path, patch.content);

  return {
    path: patch.path,
    bytesWritten: Buffer.byteLength(patch.content, "utf8"),
  };
}
