# Durable Goal Turn Lineage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a host-authoritative root/current/parent turn chain for active Goals and expose the same bounded lineage through TUI, Web, ACP, and Headless.

**Architecture:** `GoalStore` owns the lineage state and identity fencing. `SessionRuntime` coordinates mailbox ownership, durable `turn_started` persistence, and Goal binding before Provider execution; `Agent` supplies the active turn ID to tools and consumes a single Runtime method for automatic continuation. Surface adapters only project the resulting `GoalSnapshot` and never derive lineage.

**Tech Stack:** TypeScript strict mode, TypeBox, React + Ink, React + Vite, Vitest, Playwright Chromium, ACP stdio, Bun PTY, DeepSeek real API.

---

### Task 1: Define and persist the bounded lineage contract

**Files:**
- Modify: `packages/cli/src/goals/types.ts`
- Modify: `packages/cli/src/goals/GoalStore.ts`
- Modify: `packages/cli/src/context/types.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/goal-store.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/context/turn-lifecycle.test.ts`

- [ ] **Step 1: Write failing GoalStore tests**

Add tests proving that a tool-created Goal accepts a host-supplied origin turn, an external Goal remains rootless, the next bound turn moves current to parent, rebinding the same turn is idempotent, edit clears lineage, pause/resume preserves it, and stale `{goalId, objective}` claims cannot overwrite a newer Goal. Use complete `GoalSnapshot` values and real on-disk stores.

```ts
expect(created.turnLineage).toEqual({
  rootTurnId: 'turn-user-1',
  currentTurnId: 'turn-user-1',
});
expect(next.turnLineage).toEqual({
  rootTurnId: 'turn-user-1',
  currentTurnId: 'turn-goal-2',
  parentTurnId: 'turn-user-1',
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bunx vitest run --config vitest.config.ts \
  tests/unit/agent-runtime/agent/goal-store.test.ts \
  tests/unit/agent-runtime/context/turn-lifecycle.test.ts --project unit
```

Expected: failures because `GoalTurnLineage`, Goal binding APIs, and persisted turn lineage do not exist.

- [ ] **Step 3: Implement the types and GoalStore authority**

Add these bounded types in `goals/types.ts`:

```ts
export interface GoalTurnLineage {
  rootTurnId?: string;
  currentTurnId: string;
  parentTurnId?: string;
}

export interface GoalTurnBindingClaim {
  goalId: string;
  objective: string;
  expectedUpdatedAt: string;
  continuation: boolean;
  lineage: GoalTurnLineage;
}
```

Add optional `turnLineage` to `GoalSnapshot`, optional `turnId` to `GoalProgress`, and optional
`goalLineage` containing `goalId` plus the lineage fields to `SessionTurnStartInfo`. Bound every
turn ID to 1..128 characters in TypeBox schemas.

Implement in `GoalStore`:

```ts
create(input: GoalCreateInput, options?: { turnId?: string }): Promise<GoalSnapshot>
prepareTurnBinding(turnId: string, continuation: boolean): Promise<GoalTurnBindingClaim | null>
commitTurnBinding(claim: GoalTurnBindingClaim): Promise<GoalSnapshot | null>
```

`prepareTurnBinding` computes but does not persist. `commitTurnBinding` requires exact Goal ID,
objective, and `updatedAt`; it is idempotent for the same current turn, increments
`continuationCount` only when `continuation` is true, and updates lineage under the existing keyed
mutex. `edit()` clears lineage; pause/resume preserves it.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/goals/types.ts \
  packages/cli/src/goals/GoalStore.ts packages/cli/src/context/types.ts \
  packages/cli/tests/unit/agent-runtime/agent/goal-store.test.ts \
  packages/cli/tests/unit/agent-runtime/context/turn-lifecycle.test.ts
git commit -m "feat(goal): persist turn lineage"
```

### Task 2: Bind Runtime turns before Provider execution

**Files:**
- Modify: `packages/cli/src/agent/runtime/SessionRuntime.ts`
- Modify: `packages/cli/src/agent/Agent.ts`
- Modify: `packages/cli/src/agent/types.ts`
- Modify: `packages/cli/src/tools/types/ExecutionTypes.ts`
- Modify: `packages/cli/src/tools/builtin/goal/goalTools.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/session-runtime.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/agent-create.test.ts`
- Test: `packages/cli/tests/unit/tooling/tools/builtin/goal-tools.test.ts`

- [ ] **Step 1: Write failing Runtime and tool tests**

Cover these exact cases:

1. `CreateGoal` receives `ExecutionContext.turnId` and stores it as root/current.
2. `SessionRuntime.beginGoalTurn(expectedGoal)` writes one `turn_started` with matching lineage,
   then commits the Goal claim and increments continuation count exactly once.
3. A durable start failure releases the mailbox owner and leaves the Goal unchanged.
4. A stale Goal identity closes the provisional turn as failed and never reaches Provider.
5. Direct and pending user turns bind as current/parent while preserving root.
6. Agent emits `goal_continuation_started` with the freshly bound lineage and chains each next
   continuation through the previous turn.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
bunx vitest run --config vitest.config.ts \
  tests/unit/agent-runtime/agent/session-runtime.test.ts \
  tests/unit/agent-runtime/agent/agent-create.test.ts \
  tests/unit/tooling/tools/builtin/goal-tools.test.ts --project unit
```

Expected: failures on missing `turnId`, `beginGoalTurn`, and lineage snapshots.

- [ ] **Step 3: Implement Runtime ownership**

Add optional `turnId` to `ExecutionContext`. Populate it from
`options.turnFinalization?.turnId` in both StreamingToolExecutor and non-streaming execution
contexts. `CreateGoal` calls:

```ts
store.create(params, context.turnId ? { turnId: context.turnId } : undefined)
```

Add a private Runtime helper that prepares Goal lineage, saves `turn_started` with the proposed
lineage, commits the fenced claim, and releases/aborts ownership on failure. Expose:

```ts
beginGoalTurn(expected: Pick<GoalSnapshot, 'goalId' | 'objective'>):
  Promise<{ handle: ActiveTurnHandle; goal: GoalSnapshot } | null>
```

Use the helper for direct and pending turns without incrementing continuation count. Refactor the
Agent Goal loop to prepare the frontier first, then call `beginGoalTurn`, and use the returned
fresh Goal in continuation events and prompts. Remove the old split `beginGoalContinuation()` plus
`beginTurn('goal')` sequence from production paths.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/agent/runtime/SessionRuntime.ts \
  packages/cli/src/agent/Agent.ts packages/cli/src/agent/types.ts \
  packages/cli/src/tools/types/ExecutionTypes.ts \
  packages/cli/src/tools/builtin/goal/goalTools.ts \
  packages/cli/tests/unit/agent-runtime/agent/session-runtime.test.ts \
  packages/cli/tests/unit/agent-runtime/agent/agent-create.test.ts \
  packages/cli/tests/unit/tooling/tools/builtin/goal-tools.test.ts
git commit -m "feat(runtime): bind durable goal turn lineage"
```

### Task 3: Project lineage through API, Headless, and ACP

**Files:**
- Modify: `packages/cli/src/api/schemas.ts`
- Modify: `packages/cli/src/commands/headlessEvents.ts`
- Modify: `packages/cli/src/commands/headless.ts`
- Modify: `packages/cli/src/acp/Session.ts`
- Modify: `packages/cli/src/agent/loop/types.ts`
- Modify: `packages/cli/src/server/routes/session.ts`
- Test: `packages/cli/tests/unit/integrations/api/schemas.test.ts`
- Test: `packages/cli/tests/unit/cli/headless-events.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/acp/session.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/server/session-routes.test.ts`

- [ ] **Step 1: Write failing projection tests**

Require strict Goal schema parsing, Headless snake_case fields, ACP camelCase metadata, and Web SSE
`goal.continuation.started` payloads to contain one matching lineage. Reject empty, overlong,
unknown, or malformed lineage fields.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
bunx vitest run --config vitest.config.ts \
  tests/unit/integrations/api/schemas.test.ts \
  tests/unit/cli/headless-events.test.ts \
  tests/unit/agent-runtime/acp/session.test.ts \
  tests/unit/agent-runtime/server/session-routes.test.ts --project unit
```

- [ ] **Step 3: Implement passive projections**

Reuse one strict `GoalTurnLineageSchema`. Add `root_turn_id`, `current_turn_id`, and
`parent_turn_id` only to Goal JSONL events; add `turnLineage` to both ACP Goal metadata objects;
and forward the authoritative Goal snapshot unchanged over Web SSE. Do not create independent
mutable counters in any adapter.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/api/schemas.ts packages/cli/src/commands/headlessEvents.ts \
  packages/cli/src/commands/headless.ts packages/cli/src/acp/Session.ts \
  packages/cli/src/agent/loop/types.ts packages/cli/src/server/routes/session.ts \
  packages/cli/tests/unit/integrations/api/schemas.test.ts \
  packages/cli/tests/unit/cli/headless-events.test.ts \
  packages/cli/tests/unit/agent-runtime/acp/session.test.ts \
  packages/cli/tests/unit/agent-runtime/server/session-routes.test.ts
git commit -m "feat(runtime): project goal turn lineage"
```

### Task 4: Build the TUI and Web lineage surfaces

**Files:**
- Modify: `packages/cli/src/goals/prompts.ts`
- Modify: `packages/cli/src/ui/components/ChatStatusBar.tsx`
- Modify: `packages/cli/web/src/components/chat/GoalControlBar.tsx`
- Modify: `packages/cli/web/src/i18n/en.ts`
- Modify: `packages/cli/web/src/i18n/zh.ts`
- Test: `packages/cli/tests/unit/platform/ui/ChatStatusBar.test.tsx`
- Test: `packages/cli/web/tests/components/chat/GoalControlBar.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert that TUI formats root/current with eight-character bounded IDs and uses `?` for a missing
root. Assert that Web emits the three `data-blade-goal-*-turn` attributes, renders localized
Origin/Current/Parent labels in the expanded panel, and removes stale root text after an edited
rootless snapshot.

- [ ] **Step 2: Run the UI tests and verify RED**

```bash
bunx vitest run --config vitest.config.ts \
  tests/unit/platform/ui/ChatStatusBar.test.tsx --project unit
bun run --filter blade-web test -- tests/components/chat/GoalControlBar.test.tsx
```

- [ ] **Step 3: Implement bounded presentation**

Add a pure formatter for TUI lineage. Add DOM attributes and a compact monospace detail row in
Web. Keep the Goal continuation model prompt free of lineage IDs; only surface and protocol
adapters receive them.

- [ ] **Step 4: Run UI tests, Web type-check, and Web lint**

```bash
bunx vitest run --config vitest.config.ts \
  tests/unit/platform/ui/ChatStatusBar.test.tsx --project unit
bun run --filter blade-web test -- tests/components/chat/GoalControlBar.test.tsx
bun run --filter blade-web type-check
bun run --filter blade-web lint
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/goals/prompts.ts \
  packages/cli/src/ui/components/ChatStatusBar.tsx \
  packages/cli/web/src/components/chat/GoalControlBar.tsx \
  packages/cli/web/src/i18n/en.ts packages/cli/web/src/i18n/zh.ts \
  packages/cli/tests/unit/platform/ui/ChatStatusBar.test.tsx \
  packages/cli/web/tests/components/chat/GoalControlBar.test.tsx
git commit -m "feat(ui): show goal turn lineage"
```

### Task 5: Qualify all production surfaces deterministically

**Files:**
- Create: `packages/cli/tests/integration/goal-turn-lineage.test.ts`
- Create: `packages/cli/tests/support/goalTurnLineageAcpRunner.ts`
- Create: `packages/cli/tests/support/goalTurnLineagePtyRunner.ts`
- Modify: `packages/cli/tests/unit/integration/raw-pty-marker-latching.test.ts`
- Modify: `packages/cli/tests/unit/integration/session-surface-qualification-harness.test.ts`

- [ ] **Step 1: Add a deterministic alternating Provider fixture**

Use a local SSE Provider that creates a Goal inside the first user turn, returns one bounded final
per turn, accepts one user follow-up, and then completes another continuation. Record exact request
count and durable turn events without retaining prompt bodies.

- [ ] **Step 2: Add Headless, ACP, raw PTY, and Chromium tests**

For every surface assert:

```text
root = original CreateGoal user turn
first continuation parent = root
intervening user turn parent = first continuation
next continuation parent = intervening user turn
```

Also assert Web reload restoration, PTY marker latching, ACP metadata, Headless JSONL, edit
invalidation, exact request count, no stale late update, and no secret or prompt text in lineage.

- [ ] **Step 3: Run the deterministic suite three consecutive times**

```bash
bun run build
for i in 1 2 3; do
  bunx vitest run --config vitest.config.ts \
    tests/integration/goal-turn-lineage.test.ts --project integration || exit 1
done
```

Expected: `4/4` each run, `12/12` total.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/tests/integration/goal-turn-lineage.test.ts \
  packages/cli/tests/support/goalTurnLineageAcpRunner.ts \
  packages/cli/tests/support/goalTurnLineagePtyRunner.ts \
  packages/cli/tests/unit/integration/raw-pty-marker-latching.test.ts \
  packages/cli/tests/unit/integration/session-surface-qualification-harness.test.ts
git commit -m "test(goal): qualify durable turn lineage surfaces"
```

### Task 6: Add the DeepSeek Flash/Pro real-API matrix

**Files:**
- Create: `packages/cli/tests/integration/real-api/goal-turn-lineage-trajectory.test.ts`
- Modify: `packages/cli/scripts/test-config.js`
- Modify: `packages/cli/tests/unit/scripts/qualification.test.ts`

- [ ] **Step 1: Write the release-matrix contract test**

Require exact models `deepseek-v4-flash` and `deepseek-v4-pro`, exact surfaces
`headless/acp/pty/web`, production `dist`, real Chromium, Bun PTY, framework retry zero, bounded
cleanup, and registration in `realApiQualification`.

- [ ] **Step 2: Verify the manifest test fails**

```bash
bunx vitest run --config vitest.config.ts \
  tests/unit/scripts/qualification.test.ts --project unit
```

- [ ] **Step 3: Implement the eight-cell trajectory**

Use an alternating proxy: real upstream requests must produce the required Goal/Bash calls, while
local responses bound the final text and timing. Each cell must assert exact Provider counts,
root/current/parent equality between Goal sidecar and surface output, reload/resume behavior, and no
credential exposure. Do not log or persist API keys.

- [ ] **Step 4: Run the matrix**

```bash
REAL_API_TEST=1 REAL_API_RELEASE_MATRIX=1 bun run \
  test:real-api:qualification -- \
  tests/integration/real-api/goal-turn-lineage-trajectory.test.ts
```

Expected: `8/8` cells pass with zero framework retries.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/tests/integration/real-api/goal-turn-lineage-trajectory.test.ts \
  packages/cli/scripts/test-config.js \
  packages/cli/tests/unit/scripts/qualification.test.ts
git commit -m "test(goal): qualify turn lineage with real models"
```

### Task 7: Document, gate, and release v0.10.142

**Files:**
- Create: `docs/reference/goal-turn-lineage.md`
- Create: `docs/en/reference/goal-turn-lineage.md`
- Create: `docs/testing/goal-turn-lineage-evidence.md`
- Create: `docs/en/testing/goal-turn-lineage-evidence.md`
- Modify: `docs/_sidebar.md`
- Modify: `docs/en/_sidebar.md`
- Modify: `docs/testing/qualification.md`
- Modify: `docs/en/testing/qualification.md`
- Modify: `CHANGELOG.md`
- Modify: `CHANGELOG.zh.md`
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Write bilingual contract and evidence docs**

Document semantics, invalidation, restart behavior, four-surface projection, privacy boundary,
deterministic `12/12` evidence, and real-API `8/8` evidence. Do not edit generated
`docs/changelog.md` or `docs/en/changelog.md`.

- [ ] **Step 2: Run all release gates**

```bash
bun run build
bun run type-check
bun run lint
bun run test:all
bun run --filter blade-code test:coverage
bun run test:web
```

Record exact pass/fail counts. Any intermittent failure in unchanged sources must be reported as
such and rerun exactly; do not silently discard it.

- [ ] **Step 3: Prepare the independent patch version**

Set `packages/cli/package.json` to `0.10.142` and add matching English and Chinese changelog
sections. Commit with:

```bash
git commit -m "chore: release v0.10.142"
```

- [ ] **Step 4: Freeze and republish only after final verification**

```bash
bun run build && bun run test:all
git tag -a v0.10.142 -m "v0.10.142"
git push origin main
git push origin v0.10.142
```

Wait for `publish.yml`, then verify GitHub Release, `npm view blade-code version`, exact equality
of `HEAD`, `origin/main`, and `v0.10.142^{}`, preservation of `v0.10.141`, and a clean worktree.
