# Goal Execution-Host Failure Guard Qualification Evidence

- Date: 2026-09-06
- Target version: `blade-code@0.10.141`
- Real-API implementation baseline: `ccf04f67`
- Deterministic surface command: `bun run --filter blade-code test:integration -- tests/integration/goal-execution-host-failure.test.ts`
- Real-API command: `REAL_API_TEST=1 REAL_API_RELEASE_MATRIX=1 bunx vitest run --config vitest.config.ts --project=real-api tests/integration/real-api/goal-execution-host-failure-trajectory.test.ts`

## Result

The deterministic production suite launches Headless, real ACP stdio, raw PTY TUI, and
Chromium Web from the current `dist`. Every cell executes a real Bash timeout and observes
GoalStore streak `1 -> 2 -> 3`, terminal `blocked`, and no fourth continuation. The suite
passed three consecutive runs at `4/4` each, for `12/12`. Web observes count two before the
third request is released, reloads and restores the same snapshot, then reaches blocked. The
PTY runner latches each state per output chunk so bounded terminal-history rotation cannot
erase earlier evidence.

The real-API release matrix uses `deepseek-v4-flash` and `deepseek-v4-pro` across the same
four production entrypoints. It passed `8/8` in 128.89s:

| Model | Headless | ACP stdio | raw PTY TUI | Chromium Web |
| --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | 12.618s | 13.373s | 13.965s | 14.917s |
| `deepseek-v4-pro` | 16.111s | 21.455s | 16.958s | 17.952s |

Framework retry and model retry are disabled in every cell. Each cell completes three real
model requests. The model must choose Bash each time; only after parsing a real Bash tool call
does the alternating local proxy return a controlled, portable timeout command. Each cell has
exactly six downstream Provider requests, three real upstream forwards, and three verified
Bash tool-call responses. No seventh request appears after a stability wait.

## Covered contracts

- six typed-only Bash execution-host categories; ordinary non-zero exits, cancellation,
  denial, and validation errors do not count;
- logical-turn aggregation, successful-Bash suppression, continuation/restart persistence,
  category reset, and clearing after a turn without a host failure;
- atomic blocking on the third same-category failure, a stable status reason, and no fourth
  continuation from Agent;
- strict Goal API schema, Headless JSONL, ACP metadata, TUI `exec-host`, and the Web recovery
  card;
- production Chromium reload hydration, raw PTY state latching, ACP terminal release, and
  complete temporary-resource cleanup;
- no API key, command body, raw error, or private configuration in public projections or test
  output.

## Development-time exceptions

The first Pro Headless run exposed repeated Bash calls from the model: its original arguments
became an ordinary syntax error under the current Node version, so the Goal correctly did not
count a host failure. The fixture was narrowed to first verify that the real model emitted a
Bash tool call and then have the proxy return one fixed, portable infinite shell command; no
product classification semantics changed. The first PTY matrix run also exposed a PATH shim
shadowing the runner's own Node executable. The fix leaves runner PATH unchanged. The complete
eight-cell matrix passed after these corrections.

## Final gates

- `bun run build && bun run type-check && bun run lint`: passed; CLI lint checked 1,418
  files and Web lint checked 208 files.
- `bun run test:all`: passed; the non-performance stage passed 499 files and 5,839 tests
  with 101 files and 89 tests skipped. Performance passed 4 files and 9 tests with one file
  and one test skipped. Total time was 497.61s.
- `bun run --filter blade-code test:coverage`: passed; 499 files and 5,839 tests passed
  with 101 files and 89 tests skipped. Coverage was 73.89% statements, 67.26% branches,
  75.74% functions, and 75.26% lines.
- `bun run test:web`: passed; 69 files and 666 tests.

The first full gate exposed an old process-tree integration assertion that still required no
metadata after foreground lease-registration failure. That path now has authoritative
admission evidence, so a dedicated `ForegroundProcessAdmissionError` and typed `admission`
assertion were added and the focused rerun passed. The second full run had one intermittent
failure in unchanged cross-process capacity sources; its exact rerun passed. The third full
run passed completely.
