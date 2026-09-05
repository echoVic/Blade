# Durable Goal Execution-Host Failure Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 active Goal 中跨 logical turn 持久化明确的 Bash execution-host failure，连续第三次同类故障时由宿主自动 block，并把同一有界状态投影到 TUI、Web、ACP 和 Headless。

**Architecture:** Bash adapter 是失败类别的唯一权威来源；loop 只归并当前 logical turn 的 typed 结果，GoalStore 在原子 sidecar 更新中维护 streak。所有客户端只消费 GoalSnapshot，不自行解析错误或累计计数。

**Tech Stack:** TypeScript strict、TypeBox、Vitest、React + Ink、React + Vite、Hono SSE、ACP SDK、Playwright Chromium、raw PTY、DeepSeek Flash/Pro real API。

---

## 文件结构

- 新建 `packages/cli/src/goals/executionHostFailure.ts`：闭合类别、typed metadata guard、turn accumulator 与安全展示标签。
- 修改 `packages/cli/src/tools/types/ToolTypes.ts` 和 `packages/cli/src/tools/builtin/shell/bash.ts`：让真实 Bash adapter 标记权威 host failure。
- 修改 `packages/cli/src/goals/types.ts`、`GoalStore.ts`、`prompts.ts`：durable streak、自动 block、恢复提示。
- 修改 `packages/cli/src/agent/types.ts`、`loop/executeLoopGenerator.ts`、`Agent.ts`：logical-turn 归并与一次性 Goal progress 提交。
- 修改 `packages/cli/src/api/schemas.ts`、`commands/headless*.ts`、`acp/Session.ts`：strict API 与 Headless/ACP 投影。
- 修改 `packages/cli/src/ui/components/ChatStatusBar.tsx`：TUI 短状态。
- 修改 `packages/cli/web/src/components/chat/GoalControlBar.tsx` 与双语 i18n：Web 卡片和 DOM 证据属性。
- 新建 production/real-API harness 与 evidence 文档；复用已有四端 runner 约束，不建立第二套 Goal 状态机。

### Task 1: 定义闭合分类和 turn accumulator

**Files:**
- Create: `packages/cli/src/goals/executionHostFailure.ts`
- Modify: `packages/cli/src/goals/index.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts`

- [ ] **Step 1: 写分类与 accumulator 的失败测试**

测试直接调用预期 API：

```ts
const state = createGoalExecutionHostFailureAccumulator();
observeGoalExecutionHostToolResult(state, 'Bash', {
  success: false,
  llmContent: 'hidden',
  error: { type: ToolErrorType.EXECUTION_ERROR, message: 'hidden' },
  metadata: { execution_host_failure: 'spawn' },
});
expect(resolveGoalExecutionHostFailure(state)).toBe('spawn');
```

覆盖非法 category、普通 Bash exit 1、非 Bash 失败、其他工具成功、Bash 成功和同 turn 多个 failure。

- [ ] **Step 2: 运行 RED**

Run: `bun run test unit tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts`

Expected: FAIL，因为模块和导出尚不存在。

- [ ] **Step 3: 实现最小纯模块**

```ts
export const GOAL_EXECUTION_HOST_FAILURE_CATEGORIES = [
  'timeout',
  'admission',
  'spawn',
  'finalization',
  'sandbox_start',
  'terminal',
] as const;

export type GoalExecutionHostFailureCategory =
  (typeof GOAL_EXECUTION_HOST_FAILURE_CATEGORIES)[number];

export interface GoalExecutionHostFailureAccumulator {
  successfulBash: boolean;
  category?: GoalExecutionHostFailureCategory;
}
```

Guard 只读取 `metadata.execution_host_failure`，不检查 error/message/output。成功 Bash 永久使本 logical turn 的 resolve 返回 `undefined`。

- [ ] **Step 4: 运行 GREEN**

Run: `bun run test unit tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/goals/executionHostFailure.ts packages/cli/src/goals/index.ts packages/cli/tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts
git commit -m "feat(goal): classify execution host failures"
```

### Task 2: 让真实 Bash adapter 产生 typed host-failure metadata

**Files:**
- Modify: `packages/cli/src/tools/types/ToolTypes.ts`
- Modify: `packages/cli/src/tools/builtin/shell/bash.ts`
- Test: `packages/cli/tests/unit/tooling/tools/builtin/bash.test.ts`

- [ ] **Step 1: 为每个权威 Bash 边界写失败测试**

用真实 Bash invocation/transport fixture 断言 `result.metadata?.execution_host_failure` 分别为 timeout、admission、spawn、finalization、sandbox_start、terminal。增加负对照：`exit 7`、abort、permission denial、validation error 均没有 marker。

- [ ] **Step 2: 运行 RED**

Run: `bun run test unit tests/unit/tooling/tools/builtin/bash.test.ts`
Expected: 新 marker 断言 FAIL。

- [ ] **Step 3: 扩展 typed metadata 并标记真实分支**

在 `BashForegroundMetadataFields` 添加：

```ts
execution_host_failure?: GoalExecutionHostFailureCategory;
```

只在 Bash 已有确定分支中添加常量 marker；不得从字符串或 exit code 反推。为 ACP transport error 与 local spawn error 使用不同类别。

- [ ] **Step 4: 运行 GREEN 与 Bash 集成回归**

```bash
bun run test unit tests/unit/tooling/tools/builtin/bash.test.ts
bun run test integration tests/integration/durable-foreground-process.test.ts
```

Expected: PASS；如现有集成测试文件名不同，先用 `rg -l 'foreground process' packages/cli/tests/integration` 定位真实测试。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/tools/types/ToolTypes.ts packages/cli/src/tools/builtin/shell/bash.ts packages/cli/tests/unit/tooling/tools/builtin/bash.test.ts
git commit -m "feat(shell): mark execution host failures"
```

### Task 3: 在 loop 中按 logical turn 归并 host failure

**Files:**
- Modify: `packages/cli/src/agent/types.ts`
- Modify: `packages/cli/src/agent/loop/executeLoopGenerator.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/execute-loop-generator.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/execute-loop-streaming-policy.test.ts`

- [ ] **Step 1: 写失败测试**

失败 Bash 后正常 final 应返回：

```ts
expect(result.metadata).toMatchObject({
  executionHostFailureCategory: 'spawn',
});
```

同 turn 成功 Bash 后字段消失；非 Bash 成功不能清除；并行 Bash 结果只产生一个类别；streaming prelaunch 与非 streaming 路径一致。

- [ ] **Step 2: 运行 RED**

```bash
bun run test unit tests/unit/agent-runtime/agent/execute-loop-generator.test.ts tests/unit/agent-runtime/agent/execute-loop-streaming-policy.test.ts
```

Expected: FAIL，LoopResult 尚无分类。

- [ ] **Step 3: 在唯一 tool-result commit 后更新 accumulator**

在 result 已持久化并准备发布的共同路径调用 `observeGoalExecutionHostToolResult(...)`，不要在 streaming tool start 阶段累计。所有 LoopResult terminal 构造通过 helper 附加：

```ts
const executionHostFailureCategory =
  resolveGoalExecutionHostFailure(executionHostFailure);
```

字段只进入内部 `LoopResult.metadata`，不直接成为 LoopEvent。

- [ ] **Step 4: 运行 GREEN**

Run: 同 Step 2。Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/agent/types.ts packages/cli/src/agent/loop/executeLoopGenerator.ts packages/cli/tests/unit/agent-runtime/agent/execute-loop-generator.test.ts packages/cli/tests/unit/agent-runtime/agent/execute-loop-streaming-policy.test.ts
git commit -m "feat(runtime): summarize execution host failures"
```

### Task 4: 持久化 Goal streak 并自动 block

**Files:**
- Modify: `packages/cli/src/goals/types.ts`
- Modify: `packages/cli/src/goals/GoalStore.ts`
- Modify: `packages/cli/src/agent/runtime/SessionRuntime.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/goal-store.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/session-runtime.test.ts`

- [ ] **Step 1: 写 GoalStore RED 测试**

依次三次调用：

```ts
await store.recordProgress({
  tokens: 10,
  elapsedMs: 100,
  executionHostFailureCategory: 'spawn',
});
```

断言 count `1 -> 2 -> 3`、第三次 `blocked`、固定 reason、无 completion candidate。另测类别变化重置、无分类清除、restart 恢复、resume/edit/finalize 清除，以及旧 v1/v2 snapshot。

- [ ] **Step 2: 运行 RED**

```bash
bun run test unit tests/unit/agent-runtime/agent/goal-store.test.ts tests/unit/agent-runtime/agent/session-runtime.test.ts
```

Expected: FAIL，schema 与 reducer 尚无字段。

- [ ] **Step 3: 实现原子 reducer**

```ts
export const MAX_CONSECUTIVE_GOAL_EXECUTION_HOST_FAILURES = 3;

export interface GoalExecutionHostFailureState {
  category: GoalExecutionHostFailureCategory;
  consecutiveCount: number;
  detectedAt: string;
}
```

`recordProgress()` 在同一 locked update 中规范化并 block。`resume()`、`edit()`、`requestCompletion()`、`finalizeVerifiedCompletion()` 清除字段。

- [ ] **Step 4: 运行 GREEN 并检查权限**

Run: 同 Step 2。Expected: PASS，Goal 文件仍为 `0600`。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/goals/types.ts packages/cli/src/goals/GoalStore.ts packages/cli/src/agent/runtime/SessionRuntime.ts packages/cli/tests/unit/agent-runtime/agent/goal-store.test.ts packages/cli/tests/unit/agent-runtime/agent/session-runtime.test.ts
git commit -m "feat(goal): persist execution host failure streaks"
```

### Task 5: 连接 Agent continuation 与 host-owned block

**Files:**
- Modify: `packages/cli/src/agent/Agent.ts`
- Modify: `packages/cli/src/goals/prompts.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/agent-create.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts`

- [ ] **Step 1: 写三 turn RED 测试**

用真实 `GoalStore` + typed fake Bash result 驱动 Agent，断言 turn 1/2 发出 goal update 和下次 continuation；prompt 只含 category/count；turn 3 后 Goal blocked；Provider 调用恰好三次；普通 `exit_code: 1` 不触发。

- [ ] **Step 2: 运行 RED**

```bash
bun run test unit tests/unit/agent-runtime/agent/agent-create.test.ts tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts
```

Expected: FAIL，因为 Agent 未提交分类且 prompt 无诊断。

- [ ] **Step 3: 实现 Agent 接线与 prompt**

把结果字段加入唯一一次 progress 写入：

```ts
executionHostFailureCategory:
  result.metadata?.executionHostFailureCategory,
```

沿用现有 `goal.status` gate，第三次 blocked 后不再调用 `beginGoalContinuation()`。Prompt 使用枚举和整数生成，不拼接 tool 数据。

- [ ] **Step 4: 运行 GREEN**

Run: 同 Step 2。Expected: PASS，Provider call count 精确为 3。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/agent/Agent.ts packages/cli/src/goals/prompts.ts packages/cli/tests/unit/agent-runtime/agent/agent-create.test.ts packages/cli/tests/unit/agent-runtime/agent/goal-execution-host-failure.test.ts
git commit -m "feat(goal): block repeated execution host failures"
```

### Task 6: 增加 strict API、Headless 和 ACP 投影

**Files:**
- Modify: `packages/cli/src/api/schemas.ts`
- Modify: `packages/cli/src/commands/headlessEvents.ts`
- Modify: `packages/cli/src/commands/headless.ts`
- Modify: `packages/cli/src/acp/Session.ts`
- Test: `packages/cli/tests/unit/integrations/api/schemas.test.ts`
- Test: `packages/cli/tests/unit/cli/headless-events.test.ts`
- Test: `packages/cli/tests/unit/cli/headless.test.ts`
- Test: `packages/cli/tests/unit/agent-runtime/acp/session.test.ts`

- [ ] **Step 1: 写 projection RED 测试**

断言 `GoalSchema` 接受合法 state，拒绝未知 category、0、4 和额外属性；Headless JSONL 只有 snake_case category/count；ACP `blade/goal` 与 `blade/goalContinuation` 只有 category/count，不含 detectedAt、command、error 或 objective。

- [ ] **Step 2: 运行 RED**

```bash
bun run test unit tests/unit/integrations/api/schemas.test.ts tests/unit/cli/headless-events.test.ts tests/unit/cli/headless.test.ts tests/unit/agent-runtime/acp/session.test.ts
```

Expected: FAIL，投影字段不存在。

- [ ] **Step 3: 实现 closed schemas 与投影**

复用 `StringEnum(GOAL_EXECUTION_HOST_FAILURE_CATEGORIES)`，计数限定 `1..3`。ACP helper 只构造：

```ts
executionHostFailure: goal.executionHostFailure
  ? {
      category: goal.executionHostFailure.category,
      consecutiveCount: goal.executionHostFailure.consecutiveCount,
    }
  : undefined
```

- [ ] **Step 4: 运行 GREEN**

Run: 同 Step 2。Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/api/schemas.ts packages/cli/src/commands/headlessEvents.ts packages/cli/src/commands/headless.ts packages/cli/src/acp/Session.ts packages/cli/tests/unit/integrations/api/schemas.test.ts packages/cli/tests/unit/cli/headless-events.test.ts packages/cli/tests/unit/cli/headless.test.ts packages/cli/tests/unit/agent-runtime/acp/session.test.ts
git commit -m "feat(runtime): project goal host failures"
```

### Task 7: 重点建设 TUI 和 Web 表面

**Files:**
- Modify: `packages/cli/src/ui/components/ChatStatusBar.tsx`
- Modify: existing tests found by `rg -l 'ChatStatusBar' packages/cli/tests/unit/platform/ui`
- Modify: `packages/cli/web/src/components/chat/GoalControlBar.tsx`
- Modify: existing tests found by `rg -l 'GoalControlBar' packages/cli/web/src`
- Modify: `packages/cli/web/src/i18n/en.ts`
- Modify: `packages/cli/web/src/i18n/zh.ts`

- [ ] **Step 1: 写 TUI/Web RED 测试**

TUI 断言 `exec-host:spawn:2`；Web 断言两个 data attributes、双语标题、category/count、blocked reason，窄布局不渲染原始 command/error。

- [ ] **Step 2: 运行 RED**

```bash
bun run test unit <actual-chat-status-bar-test>
bun --cwd packages/cli/web test --run <actual-goal-control-bar-test>
```

Expected: FAIL。先用上方 `rg -l` 命令解析 actual file，不创建重复测试入口。

- [ ] **Step 3: 实现有界 UI**

TUI 只添加短标签。Web 卡片使用现有 amber recovery visual language，所有文案通过 i18n key，category 映射为固定 label，不直接展示任何 tool 数据。

- [ ] **Step 4: 运行 GREEN 与 Web 全套**

```bash
bun run test unit packages/cli/tests/unit/platform/ui
bun --cwd packages/cli/web test --run
```

Expected: TUI focused tests 和 Web 全套 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/ui/components/ChatStatusBar.tsx packages/cli/tests/unit/platform/ui packages/cli/web/src/components/chat/GoalControlBar.tsx packages/cli/web/src/i18n/en.ts packages/cli/web/src/i18n/zh.ts
git add <actual-goal-control-bar-test>
git commit -m "feat(ui): show goal execution host failures"
```

### Task 8: 四端 production 资格测试

**Files:**
- Create: `packages/cli/tests/integration/goal-execution-host-failure.test.ts`
- Create: `packages/cli/tests/support/goalExecutionHostFailureAcpRunner.ts`
- Create: `packages/cli/tests/support/goalExecutionHostFailurePtyRunner.ts`
- Modify: `packages/cli/tests/unit/integration/session-surface-qualification-harness.test.ts`
- Modify: `packages/cli/tests/unit/integration/raw-pty-marker-latching.test.ts`

- [ ] **Step 1: 写四端 RED trajectory**

创建受控 host-failure fixture，必须经过真实 production Bash adapter 和 GoalStore。分别验证 Headless、ACP stdio、raw PTY、Chromium Web 的 1/2/3 streak、reload/resume、blocked、零第四次 continuation、无敏感文本。

- [ ] **Step 2: 运行 RED**

Run: `bun run test integration tests/integration/goal-execution-host-failure.test.ts`
Expected: FAIL，四端尚未完整投影或 runner 未注册。

- [ ] **Step 3: 补齐 production runner 与 inventory**

Runner 使用独立 `HOME`、`BLADE_STORAGE_ROOT` 和 workspace；PTY 使用精确 terminal marker，Chromium 使用 production server 与 `page.reload()`，ACP 使用真实 SDK stdio client。所有子进程使用既有 owned-process cleanup，禁止留下 watcher。

- [ ] **Step 4: 连续运行三轮 GREEN**

Run: 对上一步命令连续执行三次。Expected: 每轮 4/4，合计 12/12。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/tests/integration/goal-execution-host-failure.test.ts packages/cli/tests/support/goalExecutionHostFailureAcpRunner.ts packages/cli/tests/support/goalExecutionHostFailurePtyRunner.ts packages/cli/tests/unit/integration/session-surface-qualification-harness.test.ts packages/cli/tests/unit/integration/raw-pty-marker-latching.test.ts
git commit -m "test(goal): qualify execution host failure surfaces"
```

### Task 9: DeepSeek Flash/Pro 八格真实 API 资格测试

**Files:**
- Create: `packages/cli/tests/integration/real-api/goal-execution-host-failure-trajectory.test.ts`
- Modify: `packages/cli/scripts/test-config.js`
- Test: `packages/cli/tests/unit/scripts/qualification.test.ts`

- [ ] **Step 1: 写 real-API RED trajectory 与 manifest 测试**

每个模型 × Headless/ACP/PTY/Web：真实模型必须调用 Bash，fixture 使真实 adapter 返回 typed host failure。记录 request count，第三次 blocked 后等待稳定窗口并断言无第四次 request。

- [ ] **Step 2: 运行 manifest RED**

Run: `bun run test unit tests/unit/scripts/qualification.test.ts`
Expected: FAIL，新 trajectory 尚未注册。

- [ ] **Step 3: 注册 scoped release qualification**

将新文件加入 `realApiQualification.files`，不更改 `REAL_API_RELEASE_MATRIX` 只选择 Flash 的既有全套策略；本 feature 的显式文件命令单独运行 Flash/Pro。

- [ ] **Step 4: 运行真实 API 8/8**

```bash
bun run test:real-api:qualification -- tests/integration/real-api/goal-execution-host-failure-trajectory.test.ts
```

Expected: 8/8 PASS。凭据只从本地受限 config 读取；输出和证据不得包含 key。

- [ ] **Step 5: 提交**

```bash
git add packages/cli/tests/integration/real-api/goal-execution-host-failure-trajectory.test.ts packages/cli/scripts/test-config.js packages/cli/tests/unit/scripts/qualification.test.ts
git commit -m "test(goal): verify host failure guard with real APIs"
```

### Task 10: 文档、全量门禁与 v0.10.141 发布

**Files:**
- Modify: `docs/reference/goal-completion-verification.md`
- Modify: `docs/en/reference/goal-completion-verification.md`
- Create: `docs/testing/goal-execution-host-failure-evidence.md`
- Create: `docs/en/testing/goal-execution-host-failure-evidence.md`
- Modify: `docs/_sidebar.md`
- Modify: `docs/en/_sidebar.md`
- Modify: `CHANGELOG.md`
- Modify: `CHANGELOG.zh.md`
- Modify: `packages/cli/package.json`

- [ ] **Step 1: 写双语 reference/evidence 和 changelog**

记录分类表、重置规则、四端 contract、真实 API 矩阵、具体命令、结果和限制。不要编辑生成的 `docs/changelog.md` 或 `docs/en/changelog.md`。版本改为 `0.10.141`。

- [ ] **Step 2: 运行 focused quality gate**

```bash
bun run type-check
bun run lint
bun --cwd packages/cli/web run type-check
bun --cwd packages/cli/web run lint
bun --cwd packages/cli/web test --run
bun run build
```

Expected: 全部 PASS。额外运行 `rg -n 'as any|as never|@ts-ignore|@ts-expect-error'` 覆盖本 patch 改动，结果为空。

- [ ] **Step 3: 运行全量测试与 coverage**

```bash
bun run test:all
bun run test:coverage
```

Expected: 全部 PASS；任何 unchanged-source intermittent failure 必须精确复跑并如实记录，不能静默跳过。

- [ ] **Step 4: 完成 prompt-to-artifact audit**

逐项映射原目标：参考实现、Runtime 稳定性、长任务活性、TUI、Web GUI、ACP、Headless、真实 API、credential 隔离、独立 patch、无 worktree。检查 production suite/manifest 确实覆盖这些要求，而不是只依赖 green proxy。

- [ ] **Step 5: 提交 release preparation**

```bash
git add packages/cli/package.json CHANGELOG.md CHANGELOG.zh.md docs/reference/goal-completion-verification.md docs/en/reference/goal-completion-verification.md docs/testing/goal-execution-host-failure-evidence.md docs/en/testing/goal-execution-host-failure-evidence.md docs/_sidebar.md docs/en/_sidebar.md
git commit -m "chore(release): prepare 0.10.141"
```

- [ ] **Step 6: 创建 annotated tag 并发布**

确认 `git status --short` 为空后执行：

```bash
git push origin main
git tag -a v0.10.141 -m "v0.10.141"
git push origin v0.10.141
gh run watch <publish-run-id> --exit-status
```

不得移动 `v0.10.140`。workflow 失败时先读日志，不重打已有 tag。

- [ ] **Step 7: 发布后验证**

```bash
gh release view v0.10.141
npm view blade-code version
git rev-parse HEAD
git rev-parse origin/main
git rev-parse 'v0.10.141^{}'
git rev-parse 'v0.10.140^{}'
git status --short --branch
```

Expected: npm 为 `0.10.141`，Release 存在，HEAD/origin/tag 同 SHA，旧 tag 保持原 SHA，工作树干净。
