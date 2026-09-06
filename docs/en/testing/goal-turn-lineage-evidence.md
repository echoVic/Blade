# Durable Goal Turn Lineage Qualification Evidence

- Date: 2026-09-06
- Target version: `blade-code@0.10.142`
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
production entrypoints. All eight release cells passed; Vitest reported
`8 passed | 1 skipped`, and the complete matrix took about 90 seconds.

| Model | Headless | ACP stdio | raw PTY TUI | Chromium Web |
| --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | passed | passed | passed | passed |
| `deepseek-v4-pro` | passed | passed | passed | passed |

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

## Completed focused gates

- `bun run build` from the current source: passed, with only the existing stale Browserslist
  data warning;
- three final deterministic four-surface runs: `12/12` passed;
- qualification, surface harness, and raw-PTY source contracts: `126/126` passed;
- CLI `bun run type-check`, Biome checks for affected files, and `git diff --check`: passed;
- the real-API DeepSeek Flash/Pro four-surface matrix: `8/8` release cells passed.

The complete repository release gate is rerun before the version commit, and its fresh output
remains authoritative for final counts.
