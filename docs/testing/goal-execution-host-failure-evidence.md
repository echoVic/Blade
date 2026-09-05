# Goal 执行宿主故障保护资格验证证据

- 日期：2026-09-06
- 目标版本：`blade-code@0.10.141`
- 真实 API 实现基线：`ccf04f67`
- 确定性表面命令：`bun run --filter blade-code test:integration -- tests/integration/goal-execution-host-failure.test.ts`
- 真实 API 命令：`REAL_API_TEST=1 REAL_API_RELEASE_MATRIX=1 bunx vitest run --config vitest.config.ts --project=real-api tests/integration/real-api/goal-execution-host-failure-trajectory.test.ts`

## 结果

确定性 production suite 从当前 `dist` 启动 Headless、真实 ACP stdio、raw PTY TUI 与
Chromium Web。每格都执行真实 Bash timeout，并从 GoalStore 观察 streak `1 -> 2 -> 3`、
最终 `blocked` 以及零第四次 continuation。四端 suite 连续运行三轮，每轮 `4/4` passed，
合计 `12/12`。Web 在第三次请求释放前观察 count 2，reload 后恢复相同快照，再进入
blocked；PTY 按每个输出 chunk 锁存三个状态，避免终端有界历史滚动抹除既有证据。

真实 API release matrix 使用 `deepseek-v4-flash` 与 `deepseek-v4-pro` 覆盖同一四个生产
入口，结果 `8/8` passed，总耗时 128.89s：

| 模型 | Headless | ACP stdio | raw PTY TUI | Chromium Web |
| --- | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | 12.618s | 13.373s | 13.965s | 14.917s |
| `deepseek-v4-pro` | 16.111s | 21.455s | 16.958s | 17.952s |

每个 cell 关闭 framework retry 和 model retry，并完成三个真实模型请求。模型每次都必须
真实选择 Bash；本地交替代理只有在解析到真实 Bash tool call 后才返回受控、可移植的 timeout
命令。每个 cell 的 downstream Provider 请求精确为 6、真实 upstream 转发为 3、已验证的
Bash tool-call response 为 3；稳定等待后仍没有第 7 个请求。

## 契约覆盖

- typed-only 的六类 Bash execution-host failure，普通非零退出、取消、拒绝和 validation
  error 均不计数；
- logical-turn 归并、成功 Bash 抑制、跨 continuation/restart 持久化、类别变化重置与无故障
  清零；
- 同类第三次故障原子 blocked，稳定 status reason，且 Agent 不发起第四次 continuation；
- strict Goal API schema、Headless JSONL、ACP metadata、TUI `exec-host` 与 Web 恢复卡片；
- production Chromium reload hydration、raw PTY 状态锁存、ACP terminal release 与全部临时
  资源清理；
- API key、命令正文、原始错误和私有配置不进入公开投影或测试输出。

## 开发期异常记录

第一次 Pro Headless 运行暴露模型重复发起 Bash 的问题：原始模型参数在当前 Node 版本下
成为普通语法错误，不会触发 timeout，因此 Goal 正确地没有累计宿主故障。fixture 随后收紧为
先验证真实模型确实产生 Bash tool call，再由代理返回固定可移植的无限 shell 命令；未修改产品
分类语义。第一次 PTY 矩阵运行还暴露 PATH shim 抢占 runner 自身 Node 的问题，修正为不改变
runner PATH。修正后的完整八格矩阵一次通过。

## 最终门禁

- `bun run build && bun run type-check && bun run lint`：passed；CLI lint 检查 1,418 个
  文件，Web lint 检查 208 个文件；
- `bun run test:all`：passed；非 performance 阶段 499 files passed、101 skipped，5,839
  tests passed、89 skipped；performance 阶段 4 files passed、1 skipped，9 tests passed、
  1 skipped；总耗时 497.61s；
- `bun run --filter blade-code test:coverage`：passed；499 files / 5,839 tests passed，
  101 files / 89 tests skipped；statements 73.89%、branches 67.26%、functions 75.74%、
  lines 75.26%；
- `bun run test:web`：passed；69 files、666 tests。

第一次全量门禁发现旧 process-tree integration assertion 仍要求 foreground lease 注册失败
不含 metadata。该路径现在有明确的 admission authority，因此补充专用
`ForegroundProcessAdmissionError` 并将断言更新为 typed `admission`；定向复验通过。第二次
全量运行只出现未修改源码中的 cross-process capacity 间歇失败，精确单测复跑通过。第三次
全量运行完整通过。版本元数据与证据提交后的最终 `bun run build && bun run test:all` 捕获到
未修改 Chromium 测试中的 snapshot 刷新竞态；同一用例精确复跑通过。
