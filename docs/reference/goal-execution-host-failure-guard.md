# Goal 执行宿主故障保护

Blade Code 会在 Goal 模式中持久跟踪 Bash 执行宿主故障，避免自动 continuation 在同一
基础设施故障上无限重试并持续消耗 token。

## 计数规则

只有 Bash adapter 通过 typed metadata 明确报告的宿主故障才会计数：

- `timeout`：前台命令达到 hard timeout；
- `admission`：受管进程准入或释放失败；
- `spawn`：shell 子进程未成功创建；
- `finalization`：本地进程组收尾或 durable lease 删除失败；若同时发生 timeout/abort，收尾失败分类优先，原停止原因仍保留为结果标记；
- `sandbox_start`：必需 sandbox 未能启动；
- `terminal`：ACP terminal transport 在产生命令结果前不可用。

计数单位是 Goal logical turn，而不是 Bash 调用次数。同一 logical turn 内，即使出现多次
同类宿主故障也只累计一次；只要有一次 Bash 成功，该 turn 就不计入 streak。其他工具成功
不能掩盖 Bash 宿主故障。

普通命令非零退出、测试失败、参数校验错误、permission deny 和用户取消均不会被推断为
宿主故障。Blade 不解析 command、stdout、stderr、错误文本或模型回答来补充分类。

## 自动阻断与恢复

同一类别连续出现时，Goal sidecar 保存 `category`、`consecutiveCount` 与 `detectedAt`。
第一次和第二次失败后，下一次 continuation 会收到只含类别和计数的恢复提示，要求检查
shell、sandbox 或 terminal 可用性并改变执行策略。连续第三个 logical turn 失败时，宿主会
原子地把 Goal 设为 `blocked`，并停止发起第四次 continuation。

没有宿主故障的 turn 会清除 streak；故障类别变化时从 1 重新计数。Goal edit、显式 resume
和完成路径也会清除状态。用户排除外部问题后可以执行 `/goal resume` 重新开始。

## 用户界面与协议

- TUI 状态栏显示 `exec-host:<category>:<count>`，最终沿用 Goal blocked 状态；
- Web Goal 控制条展开区显示双语恢复卡片，reload 后从权威 Goal snapshot 恢复；
- ACP 的 `blade/goal` 与 `blade/goalContinuation` metadata 投影 category/count；
- Headless `goal` JSONL 事件投影
  `execution_host_failure_category` 和 `execution_host_failure_count`。

这些公开表面只包含封闭类别与 1..3 计数，不包含命令、路径、输出、原始错误、环境变量或
credential。GoalStore 是唯一 streak authority，客户端不会自行累计。
