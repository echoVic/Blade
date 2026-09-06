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
入口，八个 release cell 全部通过；Vitest 报告 `8 passed | 1 skipped`，完整矩阵约 90 秒。

| 模型 | Headless | ACP stdio | raw PTY TUI | Chromium Web |
| --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | passed | passed | passed | passed |
| `deepseek-v4-pro` | passed | passed | passed | passed |

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

## 已完成的局部门禁

- 当前源码 `bun run build`：passed；只有既有 Browserslist 数据过期提示；
- 最终确定性四端 fixture 三轮：`12/12` passed；
- qualification、surface harness 与 raw-PTY source contract：`126/126` passed；
- CLI `bun run type-check`、受影响文件 Biome check 与 `git diff --check`：passed；
- 真实 API DeepSeek Flash/Pro 四端矩阵：`8/8` release cells passed。

全仓 release gate 的最终计数在版本提交前重新执行，并以该次命令输出为准。
