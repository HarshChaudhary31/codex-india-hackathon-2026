# GreenLoop Implementation Plan

## Problem

Developers receive unverified AI code suggestions. GreenLoop verifies repairs by running real tests in an isolated workspace and exposing the full agent execution trail.

## Solution

A test-driven repair agent that:

1. Loads a curated failing scenario into an isolated workspace
2. Runs real tests and confirms failure
3. Understands the failure and plans a fix
4. Generates and applies a patch
5. Re-runs tests, retries if needed
6. Self-reviews the verified result
7. Returns diffs and execution events

## Architecture

```
User / Test Runner
  ↓
Repair Orchestrator (lib/agent/orchestrator.ts)
  ↓
Repair Provider (OpenAI API at runtime, deterministic provider in tests)
  ↓
Tool Layer (read_file, write_patch, run_tests)
  ↓
Isolated Workspace (fixtures copied to temp directory)
  ↓
Allowlisted Vitest Execution
  ↓
Validation + Diff + Self-Review
  ↓
Execution Events (AgentEventBus)
```

## Codex vs Runtime AI

| Layer | Technology | Notes |
|-------|------------|-------|
| **Development** | OpenAI Codex in Cursor | Planning, implementation, debugging, test design, self-review |
| **Deployed runtime repair agent** | OpenAI API (`OPENAI_MODEL`, default `gpt-4.1-mini`) | Used by `OpenAIRepairProvider` for understand/plan/patch/review |
| **Automated tests** | `OffByOneRepairProvider` | Deterministic provider to verify infrastructure without API calls |

The project does **not** claim runtime behavior is powered by Codex unless `@openai/codex-sdk` is integrated later. Current runtime uses the OpenAI API explicitly.

## Milestones

### Completed in vertical slice 1
- [x] Git + Next.js bootstrap
- [x] Off-by-one fixture with real failing tests
- [x] Isolated workspace copy + cleanup
- [x] Allowlisted Vitest runner with timeout
- [x] Tool layer (`read_file`, `write_patch`, `run_tests`)
- [x] Orchestrator with real phases and events
- [x] Deterministic provider for automated E2E test
- [x] OpenAI runtime provider scaffold
- [x] Diff generation

### Next
- [ ] API routes + SSE streaming
- [ ] Minimal workspace UI
- [ ] Async/await and config-mock scenarios
- [ ] Security hardening + rate limiting
- [ ] Deployment verification on Vercel
- [ ] README / submission / demo docs

## File Structure

```
fixtures/off-by-one/
lib/agent/
lib/sandbox/
lib/tools/
lib/security/
lib/diff/
tests/
scripts/run-repair.ts
docs/
```

## Agent Workflow

`idle → validating (initial fail) → understanding → planning → executing → validating → [retrying → executing → validating]* → self_review → complete`

All events are emitted by the orchestrator from real actions only.

## Risks

| Risk | Mitigation |
|------|------------|
| Vercel function timeout during test runs | Keep scenarios tiny; 30s timeout; consider Vercel Sandbox or Render worker if needed |
| OpenAI patch incorrect | Max 3 retries; curated demo scenarios |
| Arbitrary code execution | Fixture allowlist, path validation, command allowlist |
| Mislabeling Codex vs OpenAI API | Separate docs and runtime labels |

## MVP Definition

A judge can select the off-by-one scenario, watch real agent phases, see tests fail then pass, inspect the diff, and read the self-review — without login.

## Deployment Notes (early)

- Vercel Node.js Serverless Functions support `child_process` and `/tmp` writes.
- Hobby timeout is 10s — may be too short for AI + tests. Pro allows up to 300s.
- If serverless limits block reliability, fallback options:
  - Frontend on Vercel + repair API on Render/Railway
  - Vercel Sandbox SDK for isolated test execution
