# Durable Goal 回合链资格验证证据

- 日期：2026-09-06
- 目标版本：`blade-code@0.10.142`
- 实现与真实 API 资格基线：`228292f8`
- 确定性表面命令：`bunx vitest run --config vitest.config.ts tests/integration/goal-turn-lineage.test.ts --project integration`
- 真实 API 命令：`REAL_API_TEST=1 REAL_API_RELEASE_MATRIX=1 bunx vitest run --config vitest.config.ts --project=real-api tests/integration/real-api/goal-turn-lineage-trajectory.test.ts`

## 结果

确定性 production suite 从当前 `dist` 启动 Headless、真实 ACP stdio、raw PTY TUI 与
production Chromium Web。最终 fixture 连续运行三轮，每轮 `4/4` passed，合计 `12/12`；
三轮 Vitest 耗时分别为 28.97s、27.50s 与 32.03s。每格形成五个绑定到同一 Goal 的 durable
`turn_started`，最终 Goal 为 `blocked`、continuation count 为 4，并精确完成 6 次 Provider
请求。Web reload 后 current/parent 不变，PTY 从真实终端输出确认完整 lineage。

真实 API release matrix 使用 `deepseek-v4-flash` 与 `deepseek-v4-pro` 覆盖相同四个生产
入口，最终八个 release cell 全部通过；Vitest 报告 `8 passed | 1 skipped`，耗时 97.25s：

| 模型 | Headless | ACP stdio | raw PTY TUI | Chromium Web |
| --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | 8.800s | 12.712s | 10.967s | 12.655s |
| `deepseek-v4-pro` | 11.553s | 12.952s | 11.610s | 13.522s |

每格关闭 framework retry 与 model retry。三个真实 upstream request 都必须由模型选择
`Bash /usr/bin/true`；代理解析并确认 tool call 后，才向 production Runtime 投影两次 `Read`
和一次终态 `UpdateGoal blocked`。因此每格精确包含 6 次 downstream Provider 请求、3 次
真实 upstream 转发和 3 次已验证的模型工具决策；稳定等待后没有第 7 次请求。代理不会记录
Authorization，runner 与失败诊断会对测试使用的 credential 做脱敏。

## 契约覆盖

- 模型内 `CreateGoal` 只能使用 host context 中的 origin turn；外部创建保持 rootless；
- continuation、direct user turn 与 durable pending turn 的 current/parent 链接，重启后从
  Goal sidecar 与 JSONL 一致恢复；
- durable `turn_started` 与 fenced Goal commit 的顺序、start 失败释放、stale commit failed
  abort，以及旧 Goal/turn progress 隔离；
- edit 清除 lineage、pause/resume 保留、同一 active turn 的额外外部输入只使 root 失效；
- strict bounded API schema、Headless snake_case、ACP camelCase、TUI 有界状态与完整
  `/goal status`、Web 本地化详情与 DOM 属性；
- production Chromium reload hydration、raw PTY composer handshake、ACP stdio terminal、
  terminal 状态收敛和临时资源清理；
- lineage 不进入 Provider prompt，API key、用户正文、工具参数和私有路径不进入公开投影
  或测试证据。

## 开发期异常记录

最初 fixture 要求模型调用 `GetGoal`，模型没有稳定选择该工具，代理 502 后 Goal 按设计
暂停。改为 Bash 后，成功 Bash 又触发独立验证分支并让下一回合选择 `Task`。最终 fixture
将真实模型要求收窄为每个 continuation 选择一次无副作用的 Bash；只有代理确认该真实工具
决策后才投影确定性的 Goal 工具轨迹。该调整没有改变产品 lineage 语义，也没有用文本回答
替代真实模型工具选择。

## 最终门禁

- `bun run build && bun run type-check && bun run lint`：passed；CLI lint 检查 1,423 个
  文件，Web lint 检查 208 个文件，只有既有 Browserslist 数据过期提示；
- `bun run test:all`：passed；非 performance 阶段 500 files passed、102 skipped，5,874
  tests passed、90 skipped；performance 阶段 4 files passed、1 skipped，9 tests passed、
  1 skipped；总耗时 568.71s；
- `bun run test:web`：passed；69 files、668 tests；
- `bun run test:coverage` 精确复跑：passed；500 files / 5,874 tests passed，102 files /
  90 tests skipped；statements 73.93%、branches 67.32%、functions 75.78%、lines 75.30%；
- 最终确定性四端 fixture 三轮：`12/12` passed；
- qualification、surface harness 与 raw-PTY source contract：`126/126` passed；
- Chromium preflight 与真实 API DeepSeek Flash/Pro 四端矩阵：passed，后者为 `8/8`
  release cells。

第一次 coverage 运行没有报告断言失败，但 Node 进程被 `SIGSEGV` 终止。macOS crash report
把 fault 定位在 Vitest worker teardown 的 V8 weak callback/GC，进程同时加载了原生
`rolldown-binding.darwin-arm64.node`。当时机器还存在两个运行超过 18 小时、各占满一核的
Blade Web `bun test` 残留，以及一个已失去 owner 的 Goal fixture Blade server；清理这三个
Blade 测试残留后，未修改产品代码或测试配置，原命令精确复跑完整通过，且没有产生新的
crash report。现有证据只能确认这是原生 worker teardown 的间歇崩溃，不能把相关性表述为
已证明的单一根因。

版本元数据与上述证据提交为 `86c97008` 后，又在该精确 HEAD 执行
`bun run build && bun run test:all`。build、非 performance 500 files / 5,874 tests、
performance 4 files / 9 tests 全部通过，总耗时 559.59s；本次没有出现新的原生崩溃。
