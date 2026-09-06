# Durable Goal Turn Lineage Qualification Evidence

- Date: 2026-09-06
- Feature version: `blade-code@0.10.142`
- Release-fix version: `blade-code@0.10.144`
- Implementation and real-API qualification baseline: `228292f8`
- Deterministic surface command: `bunx vitest run --config vitest.config.ts tests/integration/goal-turn-lineage.test.ts --project integration`
- Real-API command: `REAL_API_TEST=1 REAL_API_RELEASE_MATRIX=1 bunx vitest run --config vitest.config.ts --project=real-api tests/integration/real-api/goal-turn-lineage-trajectory.test.ts`

## Result

The deterministic production suite launches Headless, real ACP stdio, raw PTY TUI, and
production Chromium Web from the current `dist`. The final fixture passed three consecutive
runs at `4/4` each, for `12/12`; Vitest durations were 28.97s, 27.50s, and 32.03s. Every cell
creates five durable `turn_started` bindings for one Goal, finishes with `blocked` and a
continuation count of four, and performs exactly six Provider requests. Web preserves current
and parent across reload, while the PTY verifies complete lineage through real terminal output.

The real-API release matrix uses `deepseek-v4-flash` and `deepseek-v4-pro` across the same four
production entrypoints. All eight release cells passed after the isolation fix; Vitest
reported `8 passed | 1 skipped` in 94.39 seconds:

| Model | Headless | ACP stdio | raw PTY TUI | Chromium Web |
| --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | 9.810s | 8.635s | 10.215s | 11.164s |
| `deepseek-v4-pro` | 12.087s | 14.464s | 12.352s | 13.087s |

Framework retry and model retry are disabled in every cell. Each of three real upstream
requests requires the model to choose `Bash /usr/bin/true`. Only after parsing and confirming
that tool call does the proxy project two `Read` calls followed by terminal
`UpdateGoal blocked` into the production Runtime. Each cell therefore has exactly six
downstream Provider requests, three real upstream forwards, and three verified model tool
decisions; no seventh request appears after a stability wait. The proxy does not record
Authorization, and runners and failure diagnostics redact the credential used by the test.

## Covered contracts

- in-model `CreateGoal` obtains its origin turn only from host context, while external creation
  remains rootless;
- current/parent advancement across continuations, direct user turns, and durable pending
  turns, with consistent Goal-sidecar and JSONL recovery after restart;
- ordering between durable `turn_started` and fenced Goal commit, owner release after start
  failure, failed abort after a stale commit, and isolation from old Goal/turn progress;
- edit clears lineage, pause/resume preserves it, and extra external input in the same active
  turn invalidates only the ambiguous root;
- strict bounded API schema, Headless snake_case, ACP camelCase, bounded TUI status plus full
  `/goal status`, and localized Web details plus DOM attributes;
- production Chromium reload hydration, raw PTY composer handshake, ACP stdio terminal,
  terminal-state convergence, and temporary-resource cleanup;
- lineage never enters Provider prompts, and no API key, user text, tool arguments, or private
  path enters public projections or test evidence.

## Development-time exceptions

The first fixture required `GetGoal`, which the model did not select consistently; the proxy
returned 502 and the Goal paused as designed. Requiring Bash next caused a successful Bash to
activate an independent verification branch, after which a later turn selected `Task`. The
final fixture narrows the real-model contract to one side-effect-free Bash choice per
continuation and projects the deterministic Goal-tool trajectory only after verifying that
real decision. This does not change product lineage semantics or substitute a text response
for a real model tool selection.

## Final gates

- `bun run build && bun run type-check && bun run lint`: passed; CLI lint checked 1,423 files,
  Web lint checked 208 files, and build emitted only the existing stale Browserslist data
  warning;
- `bun run test:all`: passed; the non-performance stage passed 500 files and 5,874 tests with
  102 files and 90 tests skipped. Performance passed 4 files and 9 tests with one file and one
  test skipped. Total time was 568.71s;
- `bun run test:web`: passed; 69 files and 668 tests;
- the exact `bun run test:coverage` rerun: passed; 500 files and 5,874 tests passed with 102
  files and 90 tests skipped. Coverage was 73.93% statements, 67.32% branches, 75.78%
  functions, and 75.30% lines;
- three final deterministic four-surface runs: `12/12` passed;
- qualification, surface harness, and raw-PTY source contracts: `126/126` passed;
- Chromium preflight and the real-API DeepSeek Flash/Pro four-surface matrix: passed, with
  `8/8` release cells in the latter.

The first coverage run reported no assertion failure, but its Node process terminated with
`SIGSEGV`. The macOS crash report places the fault in a V8 weak callback/GC during Vitest worker
teardown, with native `rolldown-binding.darwin-arm64.node` loaded in the process. At that time,
the machine also had two Blade Web `bun test` remnants running for more than 18 hours at one
full CPU core each and an ownerless Goal-fixture Blade server. After those three Blade test
remnants were stopped, the exact command passed without any product-code or test-configuration
change and produced no new crash report. The available evidence establishes an intermittent
native worker-teardown crash, but does not prove the observed resource pressure as a single
root cause.

After version metadata and the evidence above were committed as `86c97008`,
`bun run build && bun run test:all` was executed at that exact HEAD. Build, 500
non-performance files with 5,874 tests, and 4 performance files with 9 tests all passed in
559.59 seconds, with no new native crash.

The `v0.10.142` tag workflow exposed a fixture-isolation gap on the Linux coverage runner,
which has no personal Blade configuration. The parent Vitest process created the seed Runtime
without using the model configuration already written into the temporary home, so all four
production-surface cases failed closed before any Provider request. Focused coverage under an
empty `HOME` reproduced the same `4/4` configuration failure locally. After the fix, the
fixture passes the same model resources explicitly to the parent Runtime and restores the
previous store/catalog in `finally`. Empty-`HOME` four-surface coverage passed `4/4`; ordinary
four-surface tests passed `4/4`, qualification contracts passed `47/47`, type-check and Biome
passed, and the real-API matrix passed `8/8` again in 94.39 seconds. The failed workflow
published neither npm nor a GitHub Release. The pushed `v0.10.142` tag remains in place, and
the correction ships as an independent `0.10.143` patch.

The complete `bun run test:coverage` was then executed with an empty temporary `HOME`, using
only a separate `PLAYWRIGHT_BROWSERS_PATH` to reuse the installed Chromium binary. It passed
500 files and 5,874 tests with 102 files and 90 tests skipped. Coverage was 73.90% statements,
67.27% branches, 75.76% functions, and 75.27% lines; total time was 552.54 seconds. This
matches the failed Linux coverage gate's condition of having no personal Blade configuration.

After the `0.10.143` version metadata and fix evidence were committed as `db0bb43a`,
`bun run build && bun run test:all` was executed at that exact HEAD. Build, 500
non-performance files with 5,874 tests, and 4 performance files with 9 tests all passed in
526.12 seconds.

The `v0.10.143` workflow no longer showed the model-configuration failure, but serial Linux
coverage reached the test runner's exact `900000ms` hard timeout without reporting an
assertion failure. The outer runner then terminated the complete process tree as designed,
and publishing remained blocked. After adding the four production-surface cases, 15 minutes
no longer left enough room for test finalization and coverage aggregation on that platform. A
failing-first contract raises only the coverage-specific budget to 20 minutes; ordinary
all-suite tests remain at 10 minutes and all other test-type budgets remain unchanged. This
ships as the independent `0.10.144` patch. The `v0.10.143` tag remains in place and has no
corresponding npm package or GitHub Release.
