# Codex Build Log

Evidence of meaningful Codex-assisted development for GreenLoop.  
This log covers **development-time Codex usage in Cursor**, separate from the **runtime OpenAI API** used by the deployed repair agent.

## 2026-07-28 — Repository analysis and project selection

- Used Codex to inspect an empty repository and confirm greenfield bootstrap was required.
- Evaluated three hackathon directions and selected **GreenLoop** for Agentic Coding track fit.
- Codex helped define the RED → GREEN vertical slice before UI work.

## 2026-07-28 — Architecture decisions

- Codex reviewed Vercel constraints and recommended:
  - isolated fixture workspaces in `/tmp`
  - allowlisted `vitest run` only
  - Node.js serverless routes (not Edge) for `child_process`
  - document fallback to Render if Hobby timeout is insufficient
- Chose to distinguish **Codex (development)** vs **OpenAI API (runtime)** explicitly in docs and code.

## 2026-07-28 — Bootstrap and dependency verification

- Verified live npm versions before install:
  - `next@16.2.12`
  - `vitest@4.1.10`
  - `openai@7.0.0`
  - `typescript@5.x` (via create-next-app)
- Initialized git repository for visible commit history.

## 2026-07-28 — Off-by-one vertical slice

- Codex assisted implementation of:
  - failing fixture (`fixtures/off-by-one/workspace`)
  - workspace isolation (`lib/sandbox/workspace.ts`)
  - test runner (`lib/tools/run-tests.ts`)
  - orchestrator with real event bus (`lib/agent/orchestrator.ts`)
  - diff builder (`lib/diff/build-diffs.ts`)
- Codex helped design `OffByOneRepairProvider` for deterministic automated tests without faking orchestrator events.
- Codex scaffolded `OpenAIRepairProvider` for runtime repair using OpenAI Responses API — labeled separately from Codex.

## 2026-07-28 — Test generation

- Added tests for:
  - initial failing test run
  - full RED → GREEN workflow
  - path traversal protection
  - diff output integrity

## Open questions for next Codex session

- Integrate `@openai/codex-sdk` for local/dev repair path vs keep OpenAI API for production runtime
- Validate end-to-end latency on Vercel Hobby vs Pro
- Add SSE API + minimal workspace UI
