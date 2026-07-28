import { describe, expect, it } from "vitest";

import { buildDiffs } from "@/lib/diff/build-diffs";
import {
  assertAllowedScenarioId,
  assertRelativeFilePath,
  resolveWorkspacePath,
} from "@/lib/security/limits";

describe("security limits", () => {
  it("allowlists scenario ids", () => {
    expect(() => assertAllowedScenarioId("off-by-one")).not.toThrow();
    expect(() => assertAllowedScenarioId("unknown")).toThrow(/allowlisted/);
  });

  it("rejects path traversal", () => {
    expect(() => assertRelativeFilePath("../secret.ts")).toThrow(/Invalid relative path/);
    expect(() =>
      resolveWorkspacePath("/tmp/workspace", "../../etc/passwd"),
    ).toThrow(/Path escapes workspace/);
  });
});

describe("buildDiffs", () => {
  it("returns unified diff only for changed files", () => {
    const diffs = buildDiffs(
      { "src/a.ts": "before" },
      { "src/a.ts": "after" },
    );

    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.unified).toContain("-before");
    expect(diffs[0]?.unified).toContain("+after");
  });
});
