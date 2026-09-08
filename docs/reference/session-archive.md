# Durable Session Archive

Blade 的 Session Archive 是可恢复的 durable 生命周期，不是删除别名。归档后，
conversation transcript、任务状态、fork/subagent lineage、Goal、Snapshot 和 worktree
元数据均保留；默认 Session catalog、`/resume`、ACP `session/list` 和 Web 主侧栏不再
显示该会话。

## 存储模型

JSONL transcript 仍是唯一真相。归档根只追加一条事件：

```json
{
  "type": "session_updated",
  "data": {
    "sessionId": "session-id",
    "archivedAt": "2026-08-09T00:00:00.000Z",
    "updatedAt": "2026-08-09T00:00:00.000Z"
  }
}
```

恢复会追加 `archivedAt: null`。事件不会重写或搬移历史，因此 crash 不能留下半个
transcript。

fork 和 subagent 后代通过 `parentId` 继承最近归档祖先的状态。归档父会话只提交父
事件，整棵子树在同一个 catalog projection 中原子隐藏，不需要跨多个 JSONL 文件做
伪事务。单独归档的后代拥有自己的直接 `archivedAt`；恢复父会话后，该后代仍保持
归档。

对外 metadata：

- `archivedAt`：当前生效的归档时间。
- `archivedBySessionId`：直接归档根；后代用它提示应恢复哪个祖先。

## 并发与写入栅栏

归档前 Blade 会解析完整后代集合，并按稳定 Session ID 顺序获取每个 Session lease。
任一后代满足以下条件时，整次操作零写入失败：

- task 为 `queued` 或 `running`；
- 另一个 CLI、TUI、Web server 或 ACP owner 持有 Session lease；
- transcript 在临界区内改变归档状态；
- committed workspace 与请求 workspace 不一致。

从 0.10.145 起，目录读取会先以绑定进程身份的 Session lease 检查 `running` 任务。
原 owner 退出或 PID 被复用后，若成功获得恢复 lease，Blade 会在再次检查任务状态和
owner 后追加一次 `interrupted`，解除错误的运行态和归档限制。真正持有 lease 的
Runtime 不会被目录读取中断；PID、进程 fingerprint 和 lease token 不会公开。
身份采样不可用、锁文件损坏或读取失败时不会贸然接管。旧版没有 fingerprint 的合法
lease 在 PID 仍存活时继续保守阻止接管，因此不能对这种旧记录保证 PID 重用恢复。

Web 会先拒绝 active run，再释放本进程的 idle Runtime，随后获取整棵子树 lease。
TUI 无参 `/archive` 会释放当前 idle Runtime、归档当前会话并退出；处理中的回合仍由
现有 slash-command turn gate 拒绝。带 ID 的命令只操作未被其他 owner 占用的会话。

归档状态在三个层级阻止续写：

1. `SessionRuntime.create` 在恢复 worktree、模型、MCP、LSP 或工具前拒绝。
2. `SessionService.updateSessionMetadata` 在 JSONL 原子 append 临界区拒绝直接或继承
   归档状态。
3. Web write routes 与 ACP `session/load` 在创建 owner 前拒绝。

读取 transcript 和硬删除仍可执行；恢复后才允许继续模型回合、fork、rewind 或修改
metadata。

## Catalog 与 API

默认 catalog 只返回 active Session：

```http
GET /sessions/catalog
```

归档 catalog 使用独立 cursor scope：

```http
GET /sessions/catalog?archived=true
```

active cursor 不能用于 archived catalog，反之亦然。SQLite read model 使用递归 CTE
在分页前计算继承归档状态，避免后代从 page boundary 泄漏。

从 0.10.146 起，SQLite 按实际 JSONL 源文件跟踪同步状态，按 transcript 中的工作区
身份提供目录、历史和搜索，避免含 `-`、`_` 的路径被目录名反解误判为已删除。
升级时 v8 缓存会自动重建，原始 JSONL 不变；首次读取可能较慢，后续未变化文件仍
跳过重复解析。多个文件提供同一会话时，选中来源失效后会重新比较仍有效的副本。

```http
POST /sessions/:sessionId/archive?projectPath=/absolute/path
POST /sessions/:sessionId/unarchive?projectPath=/absolute/path
```

archive 响应包含 `archivedSessionIds`；unarchive 响应包含本次恢复的
`restoredSessionIds`。Bus 对每个受影响 Session 发布 `session.archived` 或
`session.unarchived`；全局 `/events` 流仅转发 `sessionId` 和 `projectPath`，
不暴露归档操作的私有字段。已连接的其他 Web tab 无需刷新即可同步目录，且不会
切换当前会话；事件流首次连接成功或重连时重新读取 Surface 目录，补回首次握手
或断线期间的成员变化。

## 交互面

CLI/TUI：

```text
/archive
/archive <sessionId>
/unarchive <sessionId>
```

Web：

- Session 行的自定义 Popover 提供 Archive 操作。
- 主侧栏只显示 active Session。
- footer 的 Archive Popover 按需分页加载归档 Session。
- 继承归档的后代展示归档根，并禁用错误的局部恢复操作。
- 恢复后 Session 回到项目一级导航，可继续原 transcript。

ACP：

- `session/list` 默认排除归档 Session。
- `session/load` 在销毁旧 owner、读取历史或初始化新 Runtime 前 fail closed。
- ACP 没有标准 archive wire method；可使用 Blade slash command 操作其他 inactive
  Session，或由 Web/HTTP 管理面执行 archive/unarchive。

## 生产资格

确定性测试覆盖：

- 直接归档、继承归档和单独归档后代。
- active/archived catalog 与 cursor scope。
- queued/running 后代、跨进程 lease 和零部分写入。
- Runtime、Web、TUI 和 ACP 写入阻断。
- SQLite/JSONL parity、跨 workspace identity 和 Bus 多 tab 收敛。
- Web Popover 键盘焦点、Archive/Restore action 和 current Session 清理。

真实 GPT 资格执行两次模型回合：第一回合后归档，证明 Runtime 与 metadata 写入均被
拒绝；恢复后从同一 durable history 完成第二回合。

production DeepSeek Web GUI 执行：

```text
真实回合 1
→ 行菜单 Archive
→ active catalog 清空
→ archived write 返回 HTTP 409
→ Archive Popover Restore
→ 同一 Session 真实回合 2
→ fresh-tab 恢复
```

资格还要求 transcript 只包含 `archivedAt: timestamp -> null` 两次合法迁移、被拒绝
输入不落盘、fresh tab 无 application console error，并回收 server 端口与临时根。
