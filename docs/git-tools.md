# Git 工具文档

Agent CLI 现在包含了一套完整的 Git 工具，支持常见的 Git 操作。

## 工具列表

### 1. git_status - Git 仓库状态查看
查看 Git 仓库的当前状态，包括未跟踪文件、已修改文件和暂存区状态。

**参数：**
- `path` (可选): 仓库路径，默认为当前目录
- `porcelain` (可选): 使用机器可读格式
- `short` (可选): 显示简短格式

**示例：**
```bash
# 查看当前仓库状态
agent tools call git_status

# 查看简短格式状态
agent tools call git_status --params '{"short": true}'

# 查看机器可读格式状态  
agent tools call git_status --params '{"porcelain": true}'
```

### 2. git_log - Git 提交历史查看
查看 Git 提交历史记录。

**参数：**
- `path` (可选): 仓库路径，默认为当前目录
- `limit` (可选): 显示的提交数量限制，默认10
- `oneline` (可选): 每个提交显示一行
- `graph` (可选): 显示分支图形
- `author` (可选): 按作者过滤提交
- `since` (可选): 显示指定日期之后的提交
- `until` (可选): 显示指定日期之前的提交

**示例：**
```bash
# 查看最近10个提交
agent tools call git_log

# 查看最近5个提交的简短记录
agent tools call git_log --params '{"limit": 5, "oneline": true}'

# 查看带分支图的提交历史
agent tools call git_log --params '{"graph": true, "limit": 5}'

# 查看特定作者的提交
agent tools call git_log --params '{"author": "张三", "limit": 10}'

# 查看最近一周的提交
agent tools call git_log --params '{"since": "1 week ago"}'
```

### 3. git_diff - Git 文件差异查看
查看文件差异和更改内容。

**参数：**
- `path` (可选): 仓库路径，默认为当前目录
- `file` (可选): 指定文件路径
- `staged` (可选): 查看暂存区的差异
- `cached` (可选): 查看已暂存文件的差异（同staged）
- `nameOnly` (可选): 只显示文件名
- `stat` (可选): 显示统计信息
- `commit1` (可选): 第一个提交hash/分支名
- `commit2` (可选): 第二个提交hash/分支名

**示例：**
```bash
# 查看工作区与暂存区的差异
agent tools call git_diff

# 查看暂存区与最后提交的差异
agent tools call git_diff --params '{"staged": true}'

# 只显示有差异的文件名
agent tools call git_diff --params '{"nameOnly": true}'

# 显示统计信息
agent tools call git_diff --params '{"stat": true}'

# 查看特定文件的差异
agent tools call git_diff --params '{"file": "src/index.ts"}'

# 比较两个提交之间的差异
agent tools call git_diff --params '{"commit1": "HEAD~1", "commit2": "HEAD"}'
```

### 4. git_branch - Git 分支管理
管理 Git 分支，包括列出、创建、删除和切换分支。

**参数：**
- `path` (可选): 仓库路径，默认为当前目录
- `action` (可选): 操作类型 - list/create/delete/switch，默认list
- `branchName` (可选): 分支名称
- `remote` (可选): 包含远程分支
- `all` (可选): 显示所有分支（本地和远程）
- `createFrom` (可选): 从指定分支创建新分支

**示例：**
```bash
# 列出本地分支
agent tools call git_branch

# 列出所有分支（包括远程）
agent tools call git_branch --params '{"all": true}'

# 创建新分支
agent tools call git_branch --params '{"action": "create", "branchName": "feature/new-feature"}'

# 从指定分支创建新分支
agent tools call git_branch --params '{"action": "create", "branchName": "hotfix/bug-fix", "createFrom": "main"}'

# 切换分支
agent tools call git_branch --params '{"action": "switch", "branchName": "feature/new-feature"}'

# 删除分支
agent tools call git_branch --params '{"action": "delete", "branchName": "old-feature"}'
```

### 5. git_add - Git 文件暂存
添加文件到 Git 暂存区。

**参数：**
- `path` (可选): 仓库路径，默认为当前目录
- `files` (可选): 要添加的文件路径，支持通配符，用空格分隔多个文件
- `all` (可选): 添加所有修改的文件
- `update` (可选): 只添加已跟踪的文件
- `dryRun` (可选): 干运行，只显示将要添加的文件

**示例：**
```bash
# 添加当前目录下所有文件
agent tools call git_add

# 添加特定文件
agent tools call git_add --params '{"files": "src/index.ts src/utils.ts"}'

# 添加所有修改的文件
agent tools call git_add --params '{"all": true}'

# 只添加已跟踪的文件
agent tools call git_add --params '{"update": true}'

# 预览将要添加的文件
agent tools call git_add --params '{"dryRun": true, "all": true}'
```

### 6. git_commit - Git 提交更改
提交暂存区的更改。

**参数：**
- `path` (可选): 仓库路径，默认为当前目录
- `message` (必需): 提交信息
- `all` (可选): 自动暂存所有已跟踪文件的更改
- `amend` (可选): 修改最后一次提交
- `author` (可选): 指定作者 (格式: "Name <email>")
- `dryRun` (可选): 干运行，只显示将要提交的内容
- `allowEmpty` (可选): 允许空提交

**示例：**
```bash
# 提交暂存区的更改
agent tools call git_commit --params '{"message": "feat: 添加新功能"}'

# 自动暂存并提交所有已跟踪文件的更改
agent tools call git_commit --params '{"message": "fix: 修复bug", "all": true}'

# 修改最后一次提交信息
agent tools call git_commit --params '{"message": "feat: 添加新功能（更新）", "amend": true}'

# 指定作者提交
agent tools call git_commit --params '{"message": "feat: 新功能", "author": "张三 <zhangsan@example.com>"}'

# 预览提交
agent tools call git_commit --params '{"message": "feat: 新功能", "dryRun": true}'

# 允许空提交
agent tools call git_commit --params '{"message": "chore: 触发CI", "allowEmpty": true}'
```

## 智能助手中的使用

你也可以在智能助手聊天中直接询问 Git 相关问题，助手会自动选择合适的工具来回答：

```bash
# 查看仓库状态
agent chat "查看当前git仓库的状态"

# 查看提交历史
agent chat "显示最近5个提交记录"

# 查看分支信息
agent chat "列出所有分支并显示当前分支"

# 查看文件差异
agent chat "查看当前有哪些文件被修改了"

# 复杂操作
agent chat "帮我查看仓库状态，如果有未暂存的文件就添加到暂存区"
```

## 安全考虑

- 所有 Git 工具都会验证文件路径的安全性，防止路径遍历攻击
- 不支持危险的 Git 操作（如 `git reset --hard`）
- 交互式命令在自动化环境中被禁用
- 所有命令都有超时限制，防止长时间阻塞

## 错误处理

当 Git 工具执行失败时，会返回详细的错误信息：

```json
{
  "success": false,
  "error": "Git status failed: fatal: not a git repository",
  "data": null
}
```

常见错误情况：
- 不是 Git 仓库
- 权限不足
- 网络连接问题（涉及远程操作时）
- 分支不存在
- 文件路径不安全

## 扩展性

Git 工具集合采用模块化设计，未来可以轻松添加更多 Git 功能：
- `git_push` - 推送到远程仓库
- `git_pull` - 从远程仓库拉取
- `git_clone` - 克隆仓库
- `git_merge` - 合并分支
- `git_rebase` - 变基操作
- `git_stash` - 暂存工作区
- `git_tag` - 标签管理 