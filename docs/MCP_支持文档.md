# 🔗 MCP (Model Context Protocol) 支持

## 📋 概述

Blade 现已完全支持 Model Context Protocol (MCP)，这是一种标准化协议，用于大型语言模型与外部数据源和工具之间建立连接。

### 🎯 主要功能

- **MCP 客户端**：连接到外部 MCP 服务器获取资源和工具
- **MCP 服务器**：将 Blade 的工具和资源暴露给其他应用程序
- **智能集成**：在 Agent 聊天中无缝使用 MCP 资源
- **多服务器支持**：同时连接多个 MCP 服务器
- **配置管理**：便捷的服务器配置和管理

## 🚀 快速开始

### 1. 启动 MCP 服务器

```bash
# 启动 WebSocket 服务器（默认端口 3001）
blade mcp server start

# 自定义端口和地址
blade mcp server start --port 3002 --host 0.0.0.0

# 启动 Stdio 服务器
blade mcp server start --transport stdio
```

### 2. 配置 MCP 客户端

```bash
# 添加 WebSocket 服务器配置
blade mcp config add
# 按提示输入：
# - 服务器名称: my-server
# - 传输方式: WebSocket (ws)
# - WebSocket 地址: ws://localhost:3001

# 添加 Stdio 服务器配置
blade mcp config add
# 按提示输入：
# - 服务器名称: external-tool
# - 传输方式: Standard I/O (stdio)
# - 启动命令: python mcp_server.py
```

### 3. 连接和使用

```bash
# 列出已配置的服务器
blade mcp client list

# 连接到服务器
blade mcp client connect my-server

# 交互式探索服务器
blade mcp client connect my-server --interactive
```

### 4. 在聊天中使用 MCP

```bash
# 启用 MCP 的聊天
blade chat --mcp my-server "帮我查看当前项目状态"

# 连接多个服务器
blade chat --mcp my-server external-tool "分析项目并生成报告"

# 结合上下文记忆
blade chat --context --mcp my-server "基于之前的对话，更新项目文档"
```

## 📖 详细使用指南

### MCP 服务器管理

#### 启动服务器

```bash
# 基础启动
blade mcp server start

# 指定配置
blade mcp server start \
  --port 3001 \
  --host localhost \
  --transport ws
```

服务器启动后会暴露：
- **资源**: 工作区文件、Git 状态、Git 日志
- **工具**: 所有 Blade 内置工具（25+ 个）
- **提示**: 代码审查、文档生成等预定义提示

#### 可用资源

| 资源 URI | 名称 | 描述 |
|----------|------|------|
| `file://workspace` | Current Workspace | 当前工作区文件列表 |
| `git://status` | Git Status | 当前 Git 仓库状态 |
| `git://log` | Git Log | 最近的 Git 提交记录 |

#### 可用工具

服务器会暴露 Blade 的所有内置工具：

- **文件系统工具**: 读写文件、目录操作
- **Git 工具**: 状态查看、提交、分支管理
- **网络工具**: HTTP 请求、URL 处理
- **文本处理工具**: 搜索、替换、格式化
- **智能工具**: 代码审查、文档生成、智能提交
- **实用工具**: 时间戳、UUID、Base64 等

### MCP 客户端使用

#### 连接管理

```bash
# 查看连接状态
blade mcp client list

# 连接到服务器（快速查看）
blade mcp client connect server-name

# 交互式模式
blade mcp client connect server-name --interactive
```

#### 交互式操作

在交互式模式中，您可以：

1. **📋 列出资源** - 查看可用的数据源
2. **📖 读取资源** - 获取具体资源内容
3. **🔧 列出工具** - 查看可用的工具
4. **⚡ 调用工具** - 执行具体工具操作

### 配置管理

#### 添加服务器配置

```bash
blade mcp config add
```

交互式配置向导会引导您：
1. 输入服务器名称
2. 选择传输方式（WebSocket 或 Stdio）
3. 配置连接参数

#### 管理配置

```bash
# 显示当前配置
blade mcp config show

# 移除服务器配置
blade mcp config remove server-name

# 重置所有配置
blade mcp config reset
```

#### 配置文件

配置保存在 `~/.blade/mcp-config.json`：

```json
{
  "servers": {
    "my-server": {
      "name": "my-server",
      "transport": "ws",
      "endpoint": "ws://localhost:3001",
      "timeout": 10000
    },
    "external-tool": {
      "name": "external-tool",
      "transport": "stdio",
      "command": "python",
      "args": ["mcp_server.py"]
    }
  },
  "client": {
    "timeout": 30000,
    "retryAttempts": 3,
    "retryDelay": 1000
  },
  "server": {
    "port": 3001,
    "host": "localhost",
    "transport": "ws",
    "auth": {
      "enabled": false
    }
  }
}
```

## 🤖 Agent 集成

### 基本用法

```bash
# 单服务器模式
blade chat --mcp my-server "分析当前项目结构"

# 多服务器模式
blade chat --mcp server1 server2 "整合多个数据源进行分析"
```

### 高级用法

```bash
# 结合上下文记忆
blade chat --context --mcp my-server \
  "基于我们之前的讨论，使用最新的项目数据更新分析报告"

# 流式输出
blade chat --stream --mcp my-server \
  "实时分析项目状态并提供改进建议"

# 交互式聊天
blade chat --interactive --mcp my-server
```

### Agent 中的 MCP 资源访问

当启用 MCP 时，Agent 会自动：

1. **连接到指定服务器** - 建立连接并获取资源列表
2. **集成外部工具** - 将 MCP 工具添加到可用工具集
3. **智能资源选择** - 根据对话内容智能选择相关资源
4. **无缝工具调用** - 在对话中自然调用 MCP 工具

## 🔧 开发指南

### 创建自定义 MCP 服务器

```python
# 示例: Python MCP 服务器
import json
import sys
from mcp import MCPServer

server = MCPServer("my-custom-server", "1.0.0")

@server.resource("custom://data")
async def get_custom_data():
    return {
        "uri": "custom://data",
        "mimeType": "application/json",
        "text": json.dumps({"message": "Hello from custom server!"})
    }

@server.tool("custom_tool")
async def custom_tool(params):
    return {
        "content": [{"type": "text", "text": f"Processed: {params}"}],
        "isError": False
    }

if __name__ == "__main__":
    server.run_stdio()
```

### 连接到自定义服务器

```bash
# 添加自定义服务器配置
blade mcp config add
# 输入：
# - 名称: my-custom
# - 传输: stdio
# - 命令: python my_server.py

# 使用自定义服务器
blade chat --mcp my-custom "使用自定义工具处理数据"
```

## 🛡️ 安全考虑

### 认证和权限

```json
{
  "server": {
    "auth": {
      "enabled": true,
      "tokens": ["your-secret-token"]
    }
  }
}
```

### 网络安全

- 默认只监听本地地址 (localhost)
- 可配置 HTTPS/WSS 支持
- 支持防火墙友好的端口配置

### 工具权限

- 所有工具调用都经过 Blade 的安全确认机制
- 支持工具级别的权限控制
- 自动风险评估和用户确认

## 📚 使用场景

### 1. 开发环境集成

```bash
# 连接到开发环境的 MCP 服务器
blade chat --mcp dev-server \
  "检查测试覆盖率并生成改进建议"
```

### 2. 数据分析流水线

```bash
# 连接到数据分析服务器
blade chat --mcp data-server analytics-server \
  "分析最新数据并生成可视化报告"
```

### 3. 多工具协作

```bash
# 同时使用内置工具和外部工具
blade chat --mcp external-api \
  "使用内置工具分析代码，然后通过外部 API 生成文档"
```

### 4. 持续集成

```bash
# 在 CI/CD 中使用
blade chat --mcp ci-server \
  "分析构建结果并提供优化建议"
```

## 🎯 最佳实践

### 1. 服务器配置

- 为不同环境配置不同的服务器（开发、测试、生产）
- 使用描述性的服务器名称
- 定期检查和更新服务器配置

### 2. 资源管理

- 合理组织资源 URI
- 提供清晰的资源描述
- 实施适当的访问控制

### 3. 工具设计

- 保持工具功能单一且专注
- 提供详细的工具描述和参数说明
- 实施错误处理和重试机制

### 4. 性能优化

- 使用连接池管理多个连接
- 实施适当的缓存策略
- 监控连接状态和性能指标

## 🔍 故障排除

### 常见问题

#### 连接失败
```bash
# 检查服务器状态
blade mcp server start

# 验证配置
blade mcp config show

# 测试连接
blade mcp client connect server-name
```

#### 工具调用失败
```bash
# 检查工具是否可用
blade mcp client connect server-name --interactive
# 选择 "列出工具"

# 验证参数格式
blade tools info tool-name
```

#### 性能问题
```bash
# 调整超时设置
blade mcp config show
# 手动编辑配置文件中的 timeout 值
```

### 调试模式

```bash
# 启用调试模式
blade chat --mcp server-name --debug "测试连接"
```

## 📈 未来规划

### 即将推出的功能

- **SSE 传输支持** - 支持 Server-Sent Events 传输
- **批量操作** - 支持批量资源读取和工具调用
- **事件订阅** - 支持资源变更的实时通知
- **高级认证** - OAuth 2.0 和 JWT 令牌支持
- **集群支持** - 多节点 MCP 服务器集群
- **监控面板** - Web 界面的 MCP 状态监控

### 社区贡献

欢迎社区贡献：
- MCP 服务器实现
- 工具扩展
- 文档改进
- 错误报告和功能请求

## 🔗 相关链接

- [MCP 官方规范](https://spec.modelcontextprotocol.io/)
- [Blade 工具文档](./工具系统.md)
- [Agent 使用指南](./Agent使用指南.md)
- [配置管理](./配置管理.md)

---

通过 MCP 支持，Blade 成为了一个真正开放和可扩展的 AI 助手平台，能够无缝集成各种外部资源和工具，为用户提供更强大的 AI 协作体验。 