# Durable Goal Execution-Host Failure Guard Design

> 状态：批准实施
> 日期：2026-09-06
> 目标版本：v0.10.141

## 背景

Blade 已经具备 Goal execution frontier、premature-stop、重复 verifier gap、
Provider recovery、turn activity 和 durable continuation。这些机制能发现模型延期、任务
前沿不变、验证缺口和 Provider 故障，但仍有一个长任务活性空洞：`Bash` 的执行宿主连续在
启动、准入、超时、sandbox 初始化或进程收尾阶段失败时，失败计数只存在于当前
`executeLoopGenerator`。一次 Goal continuation 结束后计数丢失，后续 continuation 可以继续
重复同一个不可执行路径并消耗 token。

本地参考实现提供了互补信号：

- Codex commit `62b458c931` 把执行宿主失败按 active Goal 跨回合累计，并在第三个符合条件
  的 turn 后阻断 Goal；
- Claude Code 的 query recovery 对自动恢复次数和循环边界使用显式 circuit breaker，不把
  “继续重试”当作无限默认行为；
- Neovate 对空响应和传输类失败采用显式分类与有界恢复，而不是把所有失败等价处理；
- grok-build 的 lost-response reconciliation 只在具备权威 terminal signal 时结束 turn，
  避免用 UI 活动或文本推断运行结果。

因此本设计采用保守、宿主权威的窄分类：只累计明确标注的 `Bash` execution-host
infrastructure failure，不把普通命令退出码、测试失败、用户拒绝或模型文本纳入熔断。

## 目标

1. 把同一类执行宿主失败按 Goal logical turn 持久化，跨 continuation 和进程重启保持。
2. 第一次失败提供结构化诊断，第二次要求切换策略，连续第三次自动把 Goal 置为
   `blocked`，避免无界 token 消耗。
3. 只使用工具执行器产生的 typed metadata，不解析命令、stdout、stderr、错误文本或模型
   回答。
4. 普通非零退出、测试红灯、参数错误、permission ask/deny 和用户取消均不计数。
5. 在 TUI、Web、ACP 和 Headless 暴露同一有界状态，并支持 Web reload 与 Session resume。
6. 用真实 DeepSeek API 覆盖 Headless、ACP、raw PTY TUI 和 production Chromium Web。

## 非目标

- 不为普通 Bash 命令失败自动 block Goal。编译或测试失败是 coding agent 的正常反馈。
- 不扩展到 Browser、MCP、Task、文件工具或 Provider transport；这些 failure domain 已有
  各自的恢复协议，泛化应作为后续独立 patch。
- 不自动重启终端、修改 PATH、改变 sandbox 策略或绕过权限。
- 不保存或投影 command、cwd、stdout、stderr、原始错误、URL、环境变量或 credential。
- 不改变普通非 Goal turn、Goal completion verifier、frontier stall 或 premature-stop 语义。
- 不把本轮实现和其他 roadmap feature 合并进同一个 patch。

## 方案比较

### A. 把所有 Bash 失败都计入

实现最少，但 `npm test`、编译器诊断、grep 无匹配和用户命令返回非零都可能成为正常
调试过程。三次后自动 block 会直接削弱 Agent 解决问题能力。拒绝。

### B. 泛化为所有 execute 工具 failure guard

能够覆盖 Browser、MCP、Task 和 shell，但这些工具的成功、重放与人工交互边界不同。统一
分类容易把远端业务失败、审批拒绝和基础设施故障混为一谈，验证矩阵也过大。留作后续。

### C. Typed Bash execution-host failure guard

由 Bash 实现显式标记少量宿主级失败；Agent 在 logical turn 内归并，GoalStore 跨 turn
累计；相同类别连续三次才 block。该方案误报面最小，能直接修复长任务无界重试问题，并
保持四端统一。采用此方案。

## 失败分类

新增闭合枚举：

```ts
type GoalExecutionHostFailureCategory =
  | 'timeout'
  | 'admission'
  | 'spawn'
  | 'finalization'
  | 'sandbox_start'
  | 'terminal';
```

只有 Bash handler 自己可以通过 typed metadata 写入分类：

| 类别 | 权威信号 | 不包含 |
| --- | --- | --- |
| `timeout` | local/ACP foreground hard timeout | 普通慢命令尚在受管 background 运行 |
| `admission` | durable foreground-process admission/release 失败 | provider/task admission |
| `spawn` | shell 子进程未成功创建或 process error | 已运行命令的非零 exit code |
| `finalization` | process-group finalization 失败 | 命令自身 cleanup 失败 |
| `sandbox_start` | 必需 sandbox 无法启动且命令未执行 | 用户拒绝权限、命令内 permission denied |
| `terminal` | ACP terminal transport 在命令结果前失败 | remote command 返回非零 |

metadata 字段为 `execution_host_failure`。值必须来自枚举。`aborted`、
`permission_denied`、validation error、`exit_code !== 0` 以及缺少显式 marker 的
`execution_error` 一律不推断为 host failure。

## Logical-turn 归并

`executeLoopGenerator` 为当前 logical turn 维护两个私有事实：

- 是否观察到至少一个成功的 Bash；
- 最后一个显式 execution-host failure category。

一个 turn 只有在“出现 typed host failure 且没有任何成功 Bash”时，才在 `LoopResult` 的
内部 metadata 中返回 `executionHostFailureCategory`。同一 turn 内多次同类失败只算一次；
任何成功 Bash（包括成功转后台）证明宿主可用，并使该 turn 不进入 streak。其他工具成功
不会掩盖 Bash host failure。

分类不改变工具结果本身：模型仍看到既有 Bash 失败并可在同一 loop 内换策略。只有 logical
turn 到达终态后，`Agent` 才把有界分类交给 GoalStore。这样工具并行、流式预启动和结果
落盘顺序保持不变。

## Durable Goal 状态

`GoalSnapshot` 新增可选字段：

```ts
interface GoalExecutionHostFailureState {
  category: GoalExecutionHostFailureCategory;
  consecutiveCount: number; // 1..3
  detectedAt: string;       // ISO date-time
}
```

`GoalProgress` 新增可选 `executionHostFailureCategory`。`GoalStore.recordProgress()` 在原有
keyed lock 和原子写边界内执行：

1. 本 turn 没有分类：清除旧 `executionHostFailure`；
2. 分类与旧分类相同：计数加一，最大为 3；
3. 分类改变：从 1 重新开始；
4. 第 1、2 次保持原 Goal status；
5. 第 3 次原子改为 `blocked`，写入稳定、无原始错误的 `statusReason`，清除 completion
   candidate；
6. Goal edit、显式 resume、fresh create、completion 和 clear 都清除该状态。

“连续”按 Goal logical turn 定义。一个没有 host failure 的成功 turn 会清零，因此交替的
业务失败或普通对话不会累计。进程重启后从 Goal sidecar 恢复同一 streak。旧 version 1/2
文件没有该字段时按无 streak 读取，下一次写入仍规范化为 version 2。

## Continuation 提示

`buildGoalContinuationPrompt()` 在状态存在时加入受控块：

```text
<goal-execution-host-failure>
Category: timeout
Consecutive turns: 2/3
</goal-execution-host-failure>
```

提示不包含命令或错误文本。第一次要求检查执行环境并避免盲目重复；第二次明确要求改变
策略，验证 shell/sandbox/terminal 可用性，或选择不依赖该故障路径的可验证步骤。第三次已由
宿主 block，不会再自动发起 continuation。

## 跨端投影

### CLI / TUI

`ChatStatusBar` 在 Goal 摘要后显示短标签
`exec-host:<category>:<count>`。blocked 状态继续使用现有黄色视觉语义。raw PTY 测试必须
看到第 1/2 次计数和第 3 次 blocked，且不得出现命令、错误详情或 credential。

### Web

`GoalSchema` 接受严格的可选状态。`GoalControlBar` 暴露：

- `data-blade-goal-execution-host-failure`；
- `data-blade-goal-execution-host-failure-count`。

展开区显示双语、可访问的 execution-host recovery 卡片。SSE live update 和页面 reload
都从 authoritative GoalSnapshot 恢复；Goal clear、Session 切换和终态 lifecycle 沿用既有
清理。

### ACP

`blade/goal` metadata 增加：

```json
{
  "executionHostFailure": {
    "category": "timeout",
    "consecutiveCount": 2
  }
}
```

`blade/goalContinuation` 同步携带同一有界状态。不得发送 command、remote path 或错误
文本，不新增 mutation capability。

### Headless

现有 `goal` JSONL event 增加 `execution_host_failure_category` 和
`execution_host_failure_count`。human stderr 继续使用现有 `[goal:<status>]`，blocked reason
只使用宿主固定文案。

## 错误与并发语义

- Tool metadata marker 缺失或非法时 fail closed 为“不计数”，不能从字符串猜测。
- GoalStore 是唯一 streak authority；UI store 和客户端不得自行累加。
- 同一 logical turn 的并行 Bash 结果在 loop 内归并，GoalStore 每 turn 最多更新一次。
- Goal 已 paused/blocked/limited/complete 时不继续累计。
- Goal sidecar 写失败沿用现有 fail-closed turn failure，不能只更新 UI。
- 自动 block 后 Agent 必须停止自动 continuation；用户可检查证据后显式 `/goal resume`，
  resume 会清零 streak。
- 所有公开投影只有枚举、1..3 计数和时间，不含任意 Provider/tool 文本。

## 测试与发布准出

### TDD 确定性测试

1. Bash metadata：每个权威基础设施失败映射到正确类别；非零 exit、拒绝、取消和参数
   错误不标记。
2. Loop 归并：同 turn 多失败只计一次；成功 Bash 抑制分类；其他工具成功不抑制；metadata
   不含命令或错误。
3. GoalStore：相同类别 1→2→3、类别变化重置、无失败清零、resume/edit/complete 清零、
   原子持久化与 restart 恢复。
4. Agent：三次 Goal continuation 后 blocked，不启动第四次 Provider request；普通 Bash
   exit 1 不触发；前两次 prompt 含策略切换提示。
5. API/schema：strict TypeBox、非法类别/次数拒绝、旧快照兼容。
6. TUI/Web/ACP/Headless：统一 projection、双语 UI、reload/resume、terminal cleanup 和隐私。

### Production surface qualification

通过隔离 PATH 或受控 terminal transport 让真实 Bash handler 在命令执行前产生 typed
`spawn`/`terminal` failure，运行 production build：

- Headless JSONL：精确观察 1、2、3 和 blocked，零第四次 continuation；
- ACP stdio：观察 `blade/goal` 与 `blade/goalContinuation`；
- raw PTY TUI：观察 `exec-host` 与 blocked 状态；
- Chromium Web：观察 live count、reload 后恢复、最终 blocked DOM 和零 console error。

fixture 不能伪造 GoalStore 状态，也不能把测试 marker 写进生产逻辑。若某个平台无法可靠
制造 spawn failure，可由生产 Bash adapter 接收测试进程控制的 terminal transport；该 adapter
仍必须执行真实分类代码。

### 真实 API

使用本地受限 `config.json` 中的 `deepseek-v4-flash` 与 `deepseek-v4-pro`，对 Headless、
真实 ACP stdio、raw PTY 和 production Chromium Web 形成 8-cell 矩阵。模型必须真实产生
Bash tool call；宿主故障由本地 fault fixture 注入。每格验证：

- 至少一个真实 Provider request 和真实模型 tool call；
- 同类 host failure 跨 logical turn 持久化；
- 第三次自动 blocked 且无第四次 Provider request；
- Web reload / ACP metadata / TUI 状态 / Headless JSONL 与 sidecar 一致；
- 不输出 API key、命令正文、原始错误或私有配置。

发布前运行 focused tests、CLI/Web type-check、CLI/Web lint、Web tests、
`bun run build`、`bun run test:all`、coverage、scoped real-API qualification，并至少连续三轮
通过确定性四端 production suite。版本发布为独立 patch `0.10.141`，同步双语 changelog、
reference、qualification evidence，创建 annotated `v0.10.141` tag，等待 `publish.yml` 后验证
GitHub Release、npm version、HEAD/origin/tag SHA 和干净工作树。
