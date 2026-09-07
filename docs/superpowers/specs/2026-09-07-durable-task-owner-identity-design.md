# Durable Task Owner Identity Design

**Date:** 2026-09-07
**Target:** `blade-code@0.10.145`
**Status:** Locally qualified; remote release gate pending
**Capability:** PID-reuse-safe reconciliation of durable running tasks

## Decision summary

Blade will use the existing identity-bound `SessionLease` as the authority for
whether a persisted `running` task still has a live Runtime owner. Session
catalog reconciliation will no longer return early merely because
`process.kill(taskOwnerPid, 0)` finds an unrelated live process with the same
PID.

For each persisted running task, the reconciliation path will attempt to acquire
that Session's existing local or ACP remote lease. A matching, active lease keeps
the task running. Successfully acquiring the lease proves that no active Runtime
owns the Session, after which a fenced JSONL update changes the task to
`interrupted`. The update remains idempotent and is committed only while the
reconciler owns the Session lease.

Process identities, lease owner tokens, and PIDs remain internal. CLI/TUI, Web,
ACP, Headless, and the public Session API receive only the corrected durable task
state and the existing bounded interruption reason.

## Problem

`SessionRuntime` owns a Session lease for its entire initialized lifetime. When
a task begins running, it separately persists `taskOwnerPid: process.pid` in the
Session transcript. `SessionService.reconcileInterruptedTask()` currently
checks only whether that PID exists before considering the Session lease:

1. if the task is not `running`, it returns unchanged;
2. if there is no owner PID, it returns unchanged;
3. if `process.kill(pid, 0)` reports a live process, it returns unchanged;
4. only a visibly dead PID reaches the lease-protected interruption update.

The Session lease already records a process-start fingerprint and rejects a live
PID whose identity differs from the recorded owner. The early PID-only return in
task reconciliation bypasses that protection. If the original Blade process
exits and the operating system assigns its PID to an unrelated process, the task
can remain `running` indefinitely.

The stale state is not cosmetic. It affects every Session projection:

- CLI/TUI and Web continue to render running indicators and stop actions;
- Web task ordering and Kanban placement treat the task as active;
- retry and artifact-delivery actions remain unavailable;
- archive rejects the Session tree because a member appears active;
- local and ACP remote catalogs expose the same incorrect state;
- Headless or API clients consuming the catalog cannot distinguish the orphan.

The transcript remains the durable source of truth, so fixing only one client
would create inconsistent surfaces and leave operational gates incorrect.

## Reference findings

The local reference implementations reinforce two principles used by this
design:

- Claude Code's consolidation lock explicitly treats PID reuse as a stale-lock
  concern instead of assuming that a live PID proves ownership. Its bounded
  stale-time heuristic is suitable for short consolidation work but not for an
  unbounded interactive Session lease.
- Grok Build documents that process-restart recovery cannot assume stable
  ownership for external effects. Its process-management code also avoids using
  a recycled PID as sufficient authority for destructive actions.
- Codex protects daemon PID-file lifecycle with an independent lock and tests
  stale PID-file recovery rather than treating a PID file as ownership by
  itself.
- Neovate Code does not expose a comparable durable, identity-bound Session task
  owner in the inspected implementation. Blade should therefore strengthen its
  existing lease abstraction rather than copy a weaker PID-only pattern.

Blade already has the stronger primitive: `SessionLease` uses an exclusive file,
an opaque owner ID, a PID, and a cross-platform process-start identity. This
patch connects task reconciliation to that authority rather than adding another
lease system.

## Goals

1. Reconcile an orphaned `running` task when its former PID has been reused by an
   unrelated process.
2. Preserve `running` while the identity-validated Session lease is held by the
   active Runtime.
3. Perform interruption only while holding the same local or ACP remote Session
   lease that guards Runtime ownership.
4. Recheck task status and owner PID inside the transcript append lock so a
   concurrent terminal update cannot be overwritten.
5. Keep repeated catalog reads idempotent and append at most one interruption
   event.
6. Apply one authority rule to SQLite projection reads, JSONL fallback reads,
   exact Session lookup, archive discovery, and ACP remote catalogs.
7. Keep all process identity material private while making the corrected state
   visible consistently in CLI/TUI, Web, ACP, and Headless modes.
8. Qualify deterministic behavior, real Chromium Web behavior, raw-PTY TUI
   behavior, and real DeepSeek API trajectories before publishing one patch.

## Non-goals

- Resuming or replaying an interrupted task automatically.
- Making external tool effects exactly once across a process crash.
- Adding a second task-specific lease alongside `SessionLease`.
- Publishing owner PID, process fingerprints, lease paths, or lease owner IDs.
- Changing task admission, queue ordering, retry policy, or artifact delivery.
- Changing Session archive semantics beyond removing a false active-task block.
- Treating a live Runtime as healthy when it is hung but still owns its lease.
- Moving development to a worktree.

## Ownership invariant

For a persisted task with `taskStatus: 'running'`, an active owner is established
by an identity-validated Session lease, not by PID liveness alone.

The durable fields have distinct roles:

- `taskOwnerPid` is an internal fencing value that binds the task-status update
  observed before reconciliation to the value rechecked during the append;
- the Session lease is the exclusive ownership authority;
- the lease's process identity prevents PID reuse from preserving a stale lease;
- the lease's opaque owner ID prevents one Runtime from releasing another
  Runtime's replacement lease.

`taskOwnerPid` remains omitted from `SessionMetadata` returned to clients.
Neither the process identity nor owner ID is copied into Session events.

## Reconciliation algorithm

### Entry conditions

`SessionService.reconcileInterruptedTask()` returns immediately only when the
task is not `running` or has no valid internal owner PID. A live result from
`process.kill(pid, 0)` is no longer an early-return condition.

For a running task with an owner PID, reconciliation always enters the existing
lease-protected path.

### Lease decision

The reconciler attempts to acquire the exact Session lease:

- local Sessions use `SessionLease.acquire(sessionId, projectPath)`;
- ACP remote Sessions use `SessionLease.acquireRemote(sessionId, validatedScope)`
  after the existing exact workspace and safe-path checks.

The existing lease acquisition rules produce the required decision:

- an identity-matching live lease throws `SessionInUseError`; reconciliation
  re-reads the transcript and returns its current projection without mutation;
- a dead owner, a missing lease, or an identity mismatch allows acquisition;
  reconciliation may proceed while holding exclusive ownership;
- an identity-unavailable legacy lease with a live PID remains fail-closed for
  compatibility, because stealing an actually active older Session is worse than
  delaying reconciliation. New identity-bearing leases receive the PID-reuse
  guarantee targeted by this patch.

This design intentionally does not apply a time-based stale threshold. Coding
Sessions may remain active for hours or days, so age cannot safely prove
abandonment.

### Fenced transcript update

After acquiring the lease, the reconciler uses `JSONLStore.appendValidated()`
and derives current metadata again inside the append lock. It appends an update
only if all conditions still hold:

- `taskStatus` is still `running`;
- `taskOwnerPid` still equals the owner PID observed before lease acquisition;
- ACP remote metadata still matches the validated exact workspace descriptor.

The event records:

```ts
{
  taskStatus: 'interrupted',
  taskStatusReason: 'Task owner process exited before completion',
  taskCompletedAt: now,
  taskOwnerPid: null,
  taskQueuePosition: null,
  taskQueueDepth: null,
  updatedAt: now,
}
```

If any fence fails, the append is skipped and the latest transcript is returned.
The lease is released in `finally` on every path.

## Runtime and compatibility behavior

`SessionRuntime.initialize()` continues to acquire the Session lease before
loading tools or starting work. `setTaskStatus('running')` continues to persist
the current PID, and terminal task states continue to clear it. No Provider
prompt, model context, tool schema, or public protocol changes.

The normal active path remains safe:

1. the Runtime holds an identity-bound Session lease;
2. a catalog reader observes `running`;
3. its lease acquisition encounters the active lease and fails with
   `SessionInUseError`;
4. the reader returns the current projection unchanged.

The PID-reuse recovery path becomes:

1. the Runtime exits without committing a terminal task state;
2. another process receives the old PID;
3. a catalog reader observes `running` and attempts the Session lease;
4. `SessionLease` compares the lease fingerprint with the unrelated process and
   reclaims the stale lease;
5. the reader appends one fenced `interrupted` update;
6. every surface subsequently observes the terminal state.

Legacy leases without a process identity keep the current conservative PID
fallback. This is an explicit compatibility boundary, not a claim that PID alone
is an identity.

## Concurrency and failure handling

### Active owner during catalog reads

`SessionInUseError` is expected control flow. The reconciler re-reads the
authoritative transcript because the active owner may have completed the task
between the initial projection and the failed acquisition.

### Lease-record critical section

Acquisition and release now serialize their short record read/modify operation
with `proper-lockfile`. Contended acquisition returns `SessionInUseError`;
release retries within a bounded budget. The guard is not a second task lease
and is not held for the Runtime lifetime. A concrete identity mismatch or an
`ESRCH` liveness result permits reclamation; unavailable identity sampling,
unexpected liveness errors, malformed records and unreadable records do not.
Read permission errors are propagated without deleting the record. The existing
PID-only compatibility rule remains for valid legacy live records.

This closes a demonstrated stale-reader race where two callers could both
return a SessionLease after one deleted the other's replacement record.

### Concurrent reconcilers

Only one process can acquire the Session lease. Other readers either observe the
temporary active recovery lease and return the current projection or read the
committed interruption afterward. The inner task-status and owner-PID fence
prevents duplicate terminal events.

### Owner completes during reconciliation

An active Runtime must hold the Session lease, so a reconciler cannot acquire it
until that Runtime releases ownership. If transcript state changes before the
reconciler's append, the inner fence skips the interruption.

### Corrupt or unsafe ACP remote state

Existing remote scope validation, exact descriptor matching, symlink rejection,
and sanitized `RemoteSessionStateError` behavior remain authoritative. The patch
does not fall back to a local project bucket and does not expose remote paths in
client errors.

### Lease I/O failure

Unexpected lease or transcript I/O failures retain existing fail-open catalog
fallback boundaries where applicable, but no failure may append an interruption
without confirmed lease ownership. Archive and write operations remain
fail-closed.

## Surface behavior

No surface receives a new process-ownership field. All surfaces consume the
corrected `SessionMetadata` projection. V2 Surface candidate enumeration also
reconciles tasks before SQLite synchronization or JSONL fallback. Direct opens
reconcile before loading their projected summary.

Web archive removes exact local locator rows from the V2 Surface catalog as
well as the legacy catalog. A catalog revision change during a Surface load
forces a fresh read, even if another catalog load already pruned tombstones;
same-ID remote rows remain untouched.

### CLI/TUI

Task lists and attention surfaces stop rendering the orphan as running. Existing
interrupted-state presentation and retry actions become available. The TUI does
not need to know whether interruption came from a dead PID or PID reuse.

### Web GUI

The task leaves active Kanban and running-attention placement, the animated
running indicator and Stop action disappear, and terminal Retry and Archive
actions follow existing rules. Web state must refresh from the reconciled server
projection rather than manufacture an owner state in the browser.

### ACP

ACP remote catalogs run the same lease decision inside the validated remote
scope. The public task metadata reports `interrupted`; process identity remains
host-private.

### Headless and server API

Catalog, exact lookup, archive checks, and task operations see the reconciled
terminal state. Live task-status events remain unchanged because they describe
the current Runtime rather than catalog recovery.

### Archive

Archive member discovery already uses reconciled Session scans. A false running
task caused by PID reuse no longer blocks archive. A genuinely active
identity-bound Session lease still prevents mutation and archive acquisition.

## Performance

Only persisted `running` tasks enter lease validation. Terminal Sessions and
ordinary completed history retain the existing fast path. Active running tasks
add one failed exclusive lease acquisition and a bounded lease read during a
catalog refresh; orphaned tasks pay the recovery write once.

SQLite remains an optional read accelerator. Reconciliation still runs after
projection reads because liveness is dynamic and cannot be trusted from cached
metadata. The committed interruption is later incorporated by normal projection
synchronization.

No Provider call, process enumeration, catalog-wide polling loop, or client-side
heartbeat is added.

## Test strategy

Implementation follows test-driven development.

### Lease and service contracts

1. Write a stale Session lease whose PID equals a live process but whose process
   identity does not match; a running task must become `interrupted`.
2. Hold a real identity-bound Session lease; the same running task must remain
   `running` and receive no new transcript event.
3. Verify missing/dead-owner recovery still works and remains idempotent.
4. Verify two concurrent catalog readers append exactly one interruption.
5. Verify a task whose status or owner PID changes before the inner append is not
   overwritten.
6. Verify SQLite projection and forced JSONL fallback return the same corrected
   state.
7. Verify exact Session lookup and paginated catalog behavior.

### ACP remote contracts

1. Reproduce the reused-PID lease inside a validated ACP remote scope.
2. Assert that the remote transcript receives one interruption update without a
   local project bucket.
3. Hold a real remote Session lease and verify the task remains running.
4. Preserve exact-identity collision isolation and remote symlink rejection.

### Archive contracts

1. A PID-reused orphan descendant is reconciled and no longer blocks tree
   archive.
2. A descendant with a live identity-bound lease still blocks archive without
   partial writes.

### Surface contracts

1. TUI tests assert that refreshed orphan tasks use interrupted presentation,
   lose running attention, and expose retry rather than Stop.
2. Web component/store tests assert that reconciled metadata removes running
   animation and Stop, changes Kanban placement, and enables the existing
   terminal actions.
3. ACP and Headless serialization tests assert the public interrupted state and
   prove that PID, fingerprint, and owner ID are absent.

Surface tests may reuse existing production components and serializers. The
patch does not add duplicate client-side reconciliation logic merely to create a
source diff in every surface.

## Qualification and release gate

Before release, the patch must pass:

1. focused Session lease, Session service, archive, ACP remote, Headless, TUI,
   and Web tests;
2. repeated deterministic PID-reuse qualification covering local projection,
   JSONL fallback, and ACP remote state;
3. CLI and Web type checks, Biome lint, production build, Web suite, and full
   repository test suite;
4. real Chromium verification of the Web running-to-interrupted transition and
   action availability;
5. raw PTY verification of the corresponding TUI transition because no Computer
   Use tool is available in the current environment;
6. real DeepSeek API integration trajectories through Headless, ACP, TUI, and
   Web using locally configured credentials, with no secret copied to source,
   logs, evidence, or responses;
7. an evidence document that distinguishes deterministic PID-reuse proof from
   real-API surface regression coverage;
8. a patch version bump to `0.10.145`, synchronized English and Chinese
   changelogs, successful tag workflow, npm publication, and GitHub Release
   verification.

The generated docs changelog files remain workflow-owned and will not be edited
directly. The implementation stays on `main` as requested and does not create a
worktree.

## Acceptance criteria

The patch is accepted when all of the following are proven:

- a live unrelated process reusing the old owner PID cannot keep an
  identity-bearing orphaned task in `running`;
- a real active Runtime cannot be interrupted by catalog reconciliation;
- local projection, local JSONL, exact lookup, archive, and ACP remote paths
  agree on the result;
- interruption is durably appended once under the Session lease and inner
  transcript fence;
- no public surface exposes ownership internals;
- CLI/TUI and Web GUI render the corrected terminal behavior;
- deterministic, Chromium, PTY, and real-API qualification evidence passes;
- the independent patch is published and its artifact version is verified.
