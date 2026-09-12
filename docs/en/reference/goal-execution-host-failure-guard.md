# Goal Execution-Host Failure Guard

Blade Code durably tracks Bash execution-host failures in Goal mode so automatic
continuations cannot retry the same infrastructure failure indefinitely while consuming
tokens.

## Counting rules

Only host failures explicitly reported by the Bash adapter through typed metadata count:

- `timeout`: a foreground command reaches its hard timeout;
- `admission`: managed-process admission or release fails;
- `spawn`: the shell process cannot be created;
- `finalization`: local process-group finalization or durable lease removal fails; this category takes precedence over a concurrent timeout/abort while the original stop reason remains in result flags;
- `sandbox_start`: a required sandbox cannot start;
- `terminal`: the ACP terminal transport fails before producing a command result.

The unit of counting is a Goal logical turn, not a Bash invocation. Multiple same-category
host failures in one logical turn count once. Any successful Bash proves that the host was
usable and suppresses the failure for that turn; success from another tool does not.

An ordinary non-zero exit, failed test, validation error, permission denial, or user
cancellation is not inferred as a host failure. Blade does not parse commands, stdout,
stderr, error text, or model output to manufacture a category.

## Automatic blocking and recovery

For consecutive failures in the same category, the Goal sidecar stores `category`,
`consecutiveCount`, and `detectedAt`. After the first and second failures, the next
continuation receives a bounded prompt containing only the category and count and is told
to validate shell, sandbox, or terminal availability and change strategy. On the third
consecutive failing logical turn, the host atomically marks the Goal `blocked` and does not
start a fourth continuation.

A turn without a host failure clears the streak. A category change restarts it at one. Goal
edit, explicit resume, and completion paths also clear it. After correcting an external
problem, the user can run `/goal resume`.

## User interfaces and protocols

- The TUI status bar shows `exec-host:<category>:<count>` and then the normal blocked Goal
  state.
- The expanded Web Goal control displays a localized recovery card and restores it from the
  authoritative Goal snapshot after reload.
- ACP projects category/count in `blade/goal` and `blade/goalContinuation` metadata.
- Headless `goal` JSONL events project `execution_host_failure_category` and
  `execution_host_failure_count`.

These public surfaces contain only the closed category and a count from 1 through 3. They
never include commands, paths, output, raw errors, environment variables, or credentials.
GoalStore is the sole streak authority; clients do not count locally.
