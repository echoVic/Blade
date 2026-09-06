# Durable Goal Turn Lineage Design

> 状态：批准实施
> 日期：2026-09-06
> 目标版本：v0.10.142

## 背景

Blade 已经为用户输入、pending follow-up、Goal continuation 和 crash recovery 建立 durable
turn lifecycle，但 `turn_started` 目前只记录当前 turn ID、kind 和 inbox message IDs。Goal
sidecar 也只记录 objective、状态、预算和各类 liveness guard。自动 continuation 因此无法回答
“最初由哪个用户 turn 创建”以及“当前 turn 直接承接哪个 turn”。

这个缺口会降低长任务的可审计性。普通用户 follow-up 可以插入 active Goal，Goal 可以在运行中
被外部编辑，进程也可能在 continuation 中崩溃；如果没有宿主权威 lineage，日志、ACP client、
Headless consumer 和 Web/TUI 只能按时间猜测因果关系。

参考实现给出一致方向：

- Codex commit `4210c08def` 为 Goal continuation 保留可信 root 和直接 parent，并在外部目标
  编辑或无法归属的上下文进入 active turn 时主动使 root 失效；
- Claude Code 将 resume/fork 和 background continuation 绑定到明确 Session/parent 边界；
- Neovate 的 branch/resume 以稳定 Session identity 传递来源，而不是从展示文本反推；
- grok-build 的 lifecycle 输入明确区分用户 turn 与 harness 自动 turn。

本设计采用最小的 durable causal chain：只覆盖顶层 Goal turn，不建设通用 provenance DAG，
也不改变 Provider wire payload。

## 目标

1. 为 Goal 保存当前可信 root turn、当前 turn 和直接 parent turn。
2. 自动 continuation 始终链接到刚完成的 Goal 相关 turn，并跨进程重启恢复。
3. Goal 在用户 turn 内由 `CreateGoal` 创建时，以宿主当前 turn ID 作为 root；外部创建时不伪造
   root。
4. 普通用户 follow-up 形成新的直接 parent，但不替换原始 root。
5. active turn 收到额外外部输入，或 Goal objective 被外部编辑时，清除无法再证明的 root。
6. TUI、Web、ACP 和 Headless 从同一 GoalSnapshot 展示 bounded lineage。
7. 使用 DeepSeek Flash/Pro 对四个 production entrypoint 做真实 API 八格验证。

## 非目标

- 不建立覆盖 subagent、fork、MCP task、hook 和 compaction 的全局因果图。
- 不把 lineage ID 注入模型 prompt、system prompt 或工具结果。
- 不把 lineage 作为授权、权限继承、计费或 completion verification 的依据。
- 不解析消息内容、UI 文本、时间戳或 Provider response 猜测 parent。
- 不改变非 Goal Session 的 turn lifecycle。
- 不把该改动与 session rename、branch 命令或其他 UI feature 合并发布。

## 数据模型

Goal sidecar 新增可选状态：

```ts
interface GoalTurnLineage {
  rootTurnId?: string;
  currentTurnId: string;
  parentTurnId?: string;
}
```

三个 ID 均是 1..128 字符的不透明宿主 ID：

- `rootTurnId`：仍可信时，指向创建该 Goal 的用户 turn；
- `currentTurnId`：最近一次绑定到该 Goal 的顶层 turn；
- `parentTurnId`：`currentTurnId` 的直接 Goal-chain parent。

`SessionTurnStartInfo` 同步增加可选 `goalLineage`，内容包括 `goalId` 与上述三个 ID。这样
JSONL 是 turn 事实的 durable authority，Goal sidecar 是当前 Goal 投影。旧事件和旧 sidecar
缺少字段时继续按无 lineage 读取。Goal 文件版本保持 2；新增字段是向后兼容的可选字段。

## Lineage 建立与推进

### 模型在用户 turn 内创建 Goal

`ExecutionContext` 增加宿主只读 `turnId`。Agent 在 streaming 和非 streaming 工具路径都从
当前 `ActiveTurnHandle` 注入它。`CreateGoal` schema 不接受 lineage 参数；工具实现只使用
`context.turnId`，创建：

```text
rootTurnId = currentTurnId = active user turn
parentTurnId = absent
```

模型无法伪造这些 ID。

### 外部创建 Goal

TUI `/goal`、Web PUT 和 ACP slash command 在 turn 外创建 Goal 时没有可信 user turn，初始
lineage 为空。第一次自动 continuation 只记录 `currentTurnId`；`rootTurnId` 和
`parentTurnId` 保持缺省。后续 continuation 可以链接到上一 continuation，但仍不得补造 root。

### 自动 continuation

SessionRuntime 先获得新的 `ActiveTurnHandle`，再以该 ID 原子 claim Goal continuation。
GoalStore 将旧 `currentTurnId` 移到 `parentTurnId`，写入新的 `currentTurnId`，保留可信 root，
同时增加 `continuationCount`。随后 Runtime 把相同 lineage 写入 `turn_started`。若 Goal claim
失败，必须释放 turn owner；若 `turn_started` 写失败，必须停止本次 continuation，不能请求
Provider。

为避免 Goal sidecar 与 JSONL 的双写窗口制造幽灵 turn，Runtime 的顺序固定为：先在内存取得
handle，durably 写带 proposed lineage 的 `turn_started`，再用 turn ID 在 GoalStore 原子 commit
lineage。若 Goal commit 失败，Runtime 必须把刚写入的 turn 以 `failed` abort 收尾并释放 owner，
不能请求 Provider。这样 sidecar 永远不会指向一个未 durable start 的 turn；进程在 start 后、
Goal commit 前硬崩溃时，现有 startup recovery 会关闭该 orphan turn，而 Goal 仍保留上一个
current。

### 用户与 pending turn

已有 active Goal 时，direct user turn 或 durable pending turn 在 `turn_started` 成功后绑定为新的
`currentTurnId`，原 current 成为 parent，root 保持不变。turn 结束后下一次 Goal continuation
因此直接指向刚处理的用户输入，而不是跳过它。Goal ID 或 objective 已变化时，迟到的旧 turn
不得覆盖新 lineage。

## 失效规则与并发

每次 turn 捕获 `{goalId, objective}` 作为 compare token。`recordProgress` 和回滚只有在当前
Goal identity 仍匹配时才能修改 lineage。

- `/goal edit` 与 Web/ACP 对应的外部 objective edit 清除整个 lineage；
- Goal clear 删除 sidecar，自然移除 lineage；
- 同一 active turn 后续收到额外 steering 时，root 变为缺省，但 current/parent 保留；
- background subagent completion、team message、interaction recovery 与 user shell delivery 也按
  外部输入保守失效 root，除非未来独立 patch 为它们提供可验证的 turn provenance；
- pause/resume 不改变 objective，保留已有 lineage；
- stale turn、旧 Goal ID 或旧 objective 的迟到提交不得重建已清除的 root；
- 所有更新继续位于 GoalStore keyed mutex 和原子文件替换边界。

## Runtime 与持久化接口

新增小型内部 API，而不是把跨文件事务散落在 Agent：

- `GoalStore.create(input, { turnId? })`：仅工具路径传入受信 turn ID；
- `GoalStore.previewTurnLineage(turnId)`：在写 `turn_started` 前生成候选关系；
- `GoalStore.bindTurn(goalId, objective, lineage)`：durable start 后按 identity fence 提交；
- `GoalStore.tryBeginContinuation(turnId)`：按已绑定 lineage 增加 continuation count；
- `GoalStore.recordProgress(progress)`：progress 带 turn ID、captured Goal identity 与
  `lineageAmbiguous`；
- `SessionRuntime.beginGoalTurn()`：负责 mailbox handle、`turn_started`、Goal claim 和失败 abort；
- `SessionRuntime.saveTurnStart()`：把可选 Goal lineage 写入 durable JSONL。

Agent 只调用 Runtime facade。它不直接操作 GoalStore，也不自行拼接 parent。

## 四端投影

### TUI

Goal 状态栏增加有界 `lineage:<root-or-?>:<current>` 标签，ID 各截取 8 字符。`/goal status`
完整输出 root/current/parent。额外 steering 使 root 失效后立即显示 `?`，不能继续展示旧值。

### Web

`GoalControlBar` 增加 `data-blade-goal-root-turn`、`data-blade-goal-current-turn` 和
`data-blade-goal-parent-turn`。展开区显示本地化的 Origin/Current/Parent 行；reload 从 GET Goal
或 SSE `connected` 后的 authoritative snapshot 恢复。

### ACP

`blade/goal` 与 `blade/goalContinuation` metadata 增加：

```json
{
  "turnLineage": {
    "rootTurnId": "...",
    "currentTurnId": "...",
    "parentTurnId": "..."
  }
}
```

缺失 root 时省略该字段，不发送 `null`。

### Headless

现有 `goal` JSONL event 增加 snake_case 字段 `root_turn_id`、`current_turn_id` 与
`parent_turn_id`。不新增需要客户端排序的独立事件。

## 隐私与边界

Lineage 只包含本 Session 内部生成的 bounded turn ID 和 Goal ID。它不包含消息正文、prompt、
hook output、工具参数、路径、用户名或 credential。Provider 请求不增加 lineage metadata，
避免把内部因果标识发送到外部服务。客户端只显示或转发宿主快照，不参与 lineage 计算。

## 测试与发布准出

### TDD 单元与集成测试

1. GoalStore：tool-created root、external rootless create、continuation parent chain、旧 sidecar
   兼容、edit invalidation、pause/resume preservation、stale identity fence 和 rollback。
2. SessionRuntime：Goal claim 与 durable `turn_started` 一致，写失败回滚，restart 后 parent
   恢复，direct/pending turn 链接。
3. Agent：CreateGoal 只能获得宿主 turn ID；连续 continuation 链接；current-turn steering 清除
   root；next-turn follow-up 保留 root 并成为 parent。
4. Schema/协议：严格 ID bounds、Headless snake_case、ACP metadata、Web hydration。
5. TUI/Web：有界 label、双语 detail、DOM attributes 和 stale root 清除。

### Production surface qualification

本地 Provider fixture 驱动 production Headless、ACP stdio、raw PTY TUI 与 Chromium Web，
至少形成三个 Goal turns。四端必须观察相同 root/current/parent，Web 在 active continuation
期间 reload 后保持一致，PTY 从真实终端输出锁存 lineage。

### 真实 API

使用 `deepseek-v4-flash` 与 `deepseek-v4-pro` 形成四入口八格矩阵。每格至少完成三个真实
Provider turn，断言 request 数、Goal sidecar 与 surface projection 中的 lineage 精确一致，
且没有额外 continuation、credential 或用户正文泄漏。framework retry 与 model retry 固定为
0。

发布前运行 focused tests、CLI/Web type-check、CLI/Web lint、Web tests、`bun run build`、
`bun run test:all`、coverage 和 scoped real-API qualification。作为独立 patch 发布
`blade-code@0.10.142`。
