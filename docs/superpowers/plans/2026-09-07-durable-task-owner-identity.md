# Durable Task Owner Identity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Do not create a worktree or launch subagents. Steps use checkbox syntax for tracking.

**Goal:** Recover orphaned running tasks using SessionLease authority without exposing process ownership or interrupting a live Runtime.

**Architecture:** Reuse the existing local/ACP remote SessionLease record, including its process-start identity. Validate its exclusive acquisition and conservative error behavior before removing SessionService's PID-only short circuits. Clients continue to consume the existing interrupted task state.

**Tech Stack:** TypeScript, Bun, Vitest, JSONLStore, proper-lockfile, React/Ink, React/Vite, Playwright.

---

## Scope and safety prerequisites

The approved design is `docs/superpowers/specs/2026-09-07-durable-task-owner-identity-design.md`.
Live inspection found two prerequisites in `SessionLease.ts`: competing stale readers can unlink a replacement lease, and unavailable identity probes currently count as mismatches. These are part of making lease authority safe, not a second task-lease system. Preserve the existing record format; serialize only the short read/create/reclaim/release critical section using the installed proper-lockfile dependency. Contention must return SessionInUseError, never steal authority. Unknown identity/liveness and unreadable or malformed records must not authorize reclamation. Missing records and confirmed dead/replaced owners remain reclaimable.

## Task 1: Prove and harden lease authority

**Files:**
- Modify: `packages/cli/src/agent/runtime/SessionLease.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/session-lease.test.ts`
- Reuse: `packages/cli/tests/fixtures/hold-session-lease.ts`

- [ ] Add a stale-lease acquisition regression after the existing reused-PID test. Seed the existing lock format with the current PID and a different valid fingerprint. Run concurrent acquisitions and retain all returned leases until assertion and cleanup:

```ts
const attempts = await Promise.allSettled(
  Array.from({ length: 8 }, () => SessionLease.acquire(sessionId, projectPath))
);
const acquired = attempts.flatMap((result) =>
  result.status === 'fulfilled' ? [result.value] : []
);
try {
  expect(acquired).toHaveLength(1);
} finally {
  await Promise.all(acquired.map((lease) => lease.release()));
}
```

- [ ] Add a regression holding a real lease, then make identity sampling unavailable. The contender must reject with `BLADE_SESSION_IN_USE` and leave original bytes unchanged. Also cover a legacy live lease, an unreadable record, a corrupt record, and simultaneous releases.
- [ ] Run the tests before production changes:

```bash
perl -e 'alarm shift; exec @ARGV' 120 bun x --no-install vitest run --root packages/cli --config vitest.config.ts --project=unit tests/unit/agent-runtime/agent/session-lease.test.ts
```

Expected: exclusive-ownership or unavailable-identity assertions fail, not test bootstrap.

- [ ] Protect the whole lease-record mutation critical section, keeping the current record and public API. Catch only guard contention as SessionInUseError. Unknown record read/probe failures remain non-reclaimable. Identity mismatch requires a concrete sampled identity; do not infer mismatch from `undefined`.
- [ ] Repeat the focused command, run CLI type-check, and prove real cross-process exclusion with the existing holder fixture. Do not weaken regression assertions.

## Task 2: Route task reconciliation through lease authority

**Files:**
- Modify: `packages/cli/src/services/SessionService.ts`
- Test: `packages/cli/tests/unit/services/session-service-catalog.test.ts`
- Test: `packages/cli/tests/unit/services/session-service-remote.test.ts`
- Test: `packages/cli/tests/unit/services/session-service-archive.test.ts`

- [ ] Seed local running tasks with live PIDs plus missing/stale leases. Cover exact lookup, SQLite list and forced JSONL fallback. Preserve tests for live owners by actually acquiring their leases.
- [ ] Seed ACP remote stale leases using `getAcpRemoteSessionLeaseFilePath` inside `withValidatedAcpRemoteStateScope`; assert interruption, privacy, one durable event, no local project bucket, exact-descriptor isolation and live remote protection.
- [ ] Add archive coverage for an orphan child and for a truly owned child. Use `finally` to release fixture leases.
- [ ] Run the three service test files before changing the implementation. Expect orphan tasks incorrectly remaining running and archive rejecting them.
- [ ] Remove only the PID short-circuits, retaining the inner status/owner fence:

```ts
if (session.taskStatus !== 'running' || ownerPid === undefined) {
  return session;
}
```

```ts
if (current.taskStatus !== 'running' || current.taskOwnerPid !== ownerPid) {
  throw new SessionTaskReconciliationSkipped();
}
```

- [ ] Remove the now-unused `isProcessRunning` helper from SessionService. Keep remote path/descriptor validation and lease release unchanged.
- [ ] Add controlled races for status/owner changing before append and concurrent readers. Confirm at most one interrupted update; one contender may return the pre-commit projection while another owns recovery.
- [ ] Run focused tests and CLI/Web type-checks. Run dependent Runtime and surface tests and correct only fixtures that previously pretended an owner existed without a lease.

## Task 3: Verify existing surface behavior

**Files to reuse:**
- `packages/cli/src/ui/components/TaskManager.tsx` and existing task attention/session activation tests
- `packages/cli/web/src/components/layout/SessionRow.tsx`
- `packages/cli/web/src/components/kanban/kanbanModel.ts`
- `packages/cli/tests/unit/services/session-surface-service.test.ts`
- Existing ACP and Headless task state tests

- [ ] Confirm exact component paths before adding tests; do not add ownership logic to clients.
- [ ] Assert reconciled task states propagate through existing surface summaries without PID, fingerprint or ownerId.
- [ ] Verify interrupted tasks have no running indicator or Stop, and existing retry/archive rules apply.
- [ ] Launch the local Web dev server on a dedicated port and use Chromium against temporary test-owned storage. Exercise live-owner and orphan states plus archive actions; retain screenshots and console errors outside source.
- [ ] Exercise the TUI in a raw PTY using test-owned storage. Prefer Computer Use only if the current tool set supports it; state the actual method used.

## Task 4: Real API and release gates

- [ ] Reuse the existing real-API four-surface trajectory helpers from `packages/cli/tests/integration/real-api/` and `packages/cli/tests/support/`. Inspect configuration first without printing credential values.
- [ ] Run DeepSeek Flash/Pro across Headless, ACP, raw PTY and Chromium Web. Distinguish real-API surface regression from deterministic PID-reuse evidence.
- [ ] Keep all commands bounded and serial for heavy test suites; stop only processes started by this task and avoid accumulating exec sessions.
- [ ] Run `bun run type-check`, `bun run lint`, `bun run build`, `bun run test:web`, and `bun run test:all`; fix failures rather than bypassing gates.
- [ ] Update the existing approved design to reflect verified implementation and actual evidence. Add requested bilingual user-facing reference/evidence only for behavior proven by this patch. Never edit generated docs changelogs.
- [ ] Recheck current version before bumping `packages/cli/package.json`; intended patch is 0.10.145. Synchronize `CHANGELOG.md` and `CHANGELOG.zh.md`.
- [ ] Run release skill, commit specific files, push main and a new immutable version tag only after successful gates, and verify publish workflow, npm version/integrity and GitHub Release.

## Verification record

- Initial Lease regressions: three failures confirmed competing stale owners,
  unavailable identity and unreadable-state reclamation; follow-up malformed,
  unknown-liveness and release serialization cases also failed before fixes.
- Lease suite: 14 passing tests, including four independent contenders.
- Final focused suite: 121 tests repeated five times, 605/605 passed; the same
  focused coverage run passed 121/121. Diagnostic coverage only (not the release
  gate): SessionLease 86.45% lines, SessionService 74.61%, SessionSurfaceService
  89.45%. Coverage output: `/private/tmp/blade-010145-focused-coverage`.
- Catalog tests: 37 passing tests; exact lookup, projection, JSONL, active lease,
  ordered recovery fences and one durable interruption covered.
- Focused service/Surface/lease suite: 117 passed before the final concurrency
  additions; broader Runtime/ACP/routes/TUI suite: 469 passed.
- DeepSeek Flash/Pro x Headless/ACP/PTY/Web: 8 passed in 116.61 seconds, using the
  existing real-API Goal lineage trajectories (regression, not PID-reuse proof).
  Final 0.10.145 build rerun: 8/8 in 149.04 seconds; log
  `/private/tmp/blade-010145-real-api-final.log`.
- Final Web suite: 69 files / 669 tests, exit 0; log
  `/private/tmp/blade-010145-test-web-release.log`.
- Final CLI/Web/VSCode type checks, repository lint and `git diff --check` passed.
  Build passed through the standard test runner's production build gate.
- Chromium dev-server and production PTY qualification passed using
  `bun packages/cli/tests/support/taskOwnerIdentitySurfaceQualification.ts`.
  Evidence root: `/private/tmp/bladeownerswepBB`.
- Web archive now prunes the exact Surface locator. A concurrent catalog
  revision change forces a fresh Surface read so pruning legacy tombstones
  cannot revive archived rows; the store suite passes 121 tests.
- Final Chromium/PTY evidence after the revision fence:
  `/private/tmp/bladeownerpc7Syk` (all assertions passed, no browser errors).
- First full suite: 5897 passed, one failure in unchanged
  `remote-workspace-reference.test.ts` (holder exited before lock acquisition).
  Isolated rerun: 15/15. A fresh full run is still required.
- First Web suite overlapped the all-suite build and found dist/web temporarily
  absent; serial rerun: 668/668. Do not overlap dist consumers with builds.
- A second full run ended in native SIGSEGV. macOS incident
  `37CDA167-862D-422F-9102-A8FD3A83B32B` shows V8 first-pass weak callbacks
  during `WorkerThreadData` teardown, with Rolldown native bindings loaded.
  This does not prove a business-code cause or complete verification. A serial
  `CI=true bun run test:all` then exceeded the unchanged 600,000ms budget.
  A two-fork-worker run finished with 5895 passes and four path-resolution
  failures because `--root` does not change `process.cwd()` for legacy tests.
  Re-running in `packages/cli` corrects the invocation without changing tests;
  the performance project remains a separate required gate. Correct-directory
  Browser security checks passed 2/2.
- Exact local lookup now checks committed workspace before reconciliation;
  the path-collision test first reproduced an extra unauthorized update, then
  passed with the fence before the mutation. Follow-up focused run: 101/101.
- Correct-directory full fork run: 5898 passed, one Web turn-activity fixture
  cleanup failed with ENOTEMPTY in `.locks`. The fixture sent SIGTERM without
  awaiting server exit; it now reuses `stopForegroundGuiLauncher` before root
  deletion. The two turn-activity surface tests passed after this correction.
  A fresh standard `bun run test:all` passed after the fixture correction:
  non-performance 500 files / 5899 tests; performance 4 files / 9 tests;
  exit 0, 553.76 seconds. Log: `/private/tmp/blade-010145-test-all-release.log`.
- Known separately scoped issue: syncAll GC can remove valid local projection
  rows when the directory name reverses ambiguously (`_` or `-` in workspace).
  Chromium evidence: `blade-task-owner-ui-PWFOCE` under the OS temporary directory;
  server reported `Session not found` after V2 and legacy catalog reads. This
  remains uncorrected and is not evidence of complete production readiness.

## Self-review

Lease exclusivity and unknown-probe conservatism are prerequisites for the approved ownership invariant. Service tests cover all durable recovery entry paths; UI qualification validates existing presentation rather than adding duplicate client authority. Real API runs are not substituted for PID-reuse tests. Publication and the larger production-readiness goal remain incomplete until their own evidence is collected.
