# 🚀 发包脚本使用指南

Blade AI 提供了一套完整的自动化发包工具，可以帮助您安全、高效地发布新版本。

## 📋 功能特性

### ✅ 版本管理
- 🔍 智能版本冲突检测 (Git tags vs npm registry)
- 🔢 自动版本递增 (major/minor/patch)
- 🏷️ 灵活的标签前缀配置

### 📝 Changelog 自动生成
- 📊 基于 Git 提交历史自动生成
- 🏷️ 智能提交分类 (feat/fix/docs/chore等)
- 📅 自动添加发布日期
- 📄 支持自定义 changelog 模板

### 🛡️ 安全检查
- 📋 工作目录状态检查
- 🧪 自动运行测试套件
- 🔍 代码质量检查
- 🌐 远程版本冲突检测

### 🔧 灵活配置
- ⚙️ 可配置的发布流程
- 🚫 可选的步骤跳过
- 🏃 预演模式 (dry-run)
- 📬 通知系统支持

## 🚀 快速开始

### 基本发布
```bash
# 发布补丁版本 (1.0.0 -> 1.0.1)
npm run release

# 发布次版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 发布主版本 (1.0.0 -> 2.0.0)  
npm run release:major
```

### 预演模式
```bash
# 预览发布过程，不实际执行（推荐）
npm run release:dry

# 预览主版本发布
npm run release -- --dry-run --major
```

### 跳过特定步骤
```bash
# 跳过测试
npm run release -- --skip-tests

# 跳过构建
npm run release -- --skip-build

# 组合使用
npm run release -- --skip-tests --skip-build --minor
```

## ⚙️ 配置文件

项目根目录的 `release.config.js` 文件控制发布行为：

```javascript
export default {
  // 发布前检查
  preChecks: {
    checkWorkingDirectory: true,  // 检查工作目录
    runTests: true,              // 运行测试
    checkCodeQuality: true,      // 检查代码质量
    checkVersionConflicts: true, // 检查版本冲突
  },
  
  // 版本管理
  version: {
    defaultType: 'patch',        // 默认发布类型
    autoIncrement: true,         // 自动递增版本
    tagPrefix: 'v',             // 标签前缀
  },
  
  // Changelog 配置
  changelog: {
    generate: true,              // 生成 changelog
    file: 'CHANGELOG.md',       // 文件路径
    categories: {               // 提交分类
      feat: '✨ 新功能',
      fix: '🐛 问题修复',
      docs: '📝 文档更新',
      style: '💄 代码格式',
      refactor: '♻️ 代码重构',
      perf: '⚡ 性能优化',
      test: '✅ 测试相关',
      chore: '🔧 其他更改',
    },
  },
  
  // 构建配置
  build: {
    beforePublish: true,         // 发布前构建
    command: 'npm run build',   // 构建命令
  },
  
  // 发布配置
  publish: {
    npm: true,                   // 发布到 npm
    npmConfig: {
      access: 'public',         // npm 访问权限
      registry: 'https://registry.npmjs.org/',
    },
    git: true,                   // 推送到 git
    gitConfig: {
      pushTags: true,           // 推送标签
      pushBranch: true,         // 推送分支
    },
  },
};
```

## 📝 Changelog 格式

脚本会根据提交信息自动生成 changelog：

### 提交格式
```bash
# 新功能
git commit -m "feat: 添加用户认证功能"

# 问题修复  
git commit -m "fix: 修复登录页面样式问题"

# 文档更新
git commit -m "docs: 更新API文档"

# 其他类型
git commit -m "chore: 更新依赖包版本"
```

### 生成的 Changelog
```markdown
## [1.2.0] - 2024-01-15

### ✨ 新功能

- 添加用户认证功能 (a1b2c3d)
- 支持多语言切换 (e4f5g6h)

### 🐛 问题修复

- 修复登录页面样式问题 (i7j8k9l)
- 解决数据加载缓慢问题 (m0n1o2p)

### 📝 文档更新

- 更新API文档 (q3r4s5t)
- 添加部署指南 (u6v7w8x)

### 🔧 其他更改

- 更新依赖包版本 (y9z0a1b)
```

## 🔄 发布流程

脚本按以下顺序执行：

1. **🔍 预发布检查** - 综合检查项目基本信息、依赖安全、文档等
2. **📋 检查工作目录** - 确保没有未提交的更改
3. **🔍 检查代码质量** - 运行 linting 和格式检查
4. **🔢 确定新版本号** - 检查冲突并递增版本
5. **📝 生成 Changelog** - 基于 Git 提交自动生成
6. **📦 更新 package.json** - 修改版本号
7. **�� 构建项目** - 运行构建命令
8. **🧪 运行测试** - 执行测试套件
9. **📝 提交更改** - 提交版本更新和 changelog
10. **🏷️ 创建标签** - 创建版本标签
11. **📦 发布到 npm** - 推送到 npm registry
12. **🚀 推送到 Git** - 推送代码和标签到远程仓库

## 🛡️ 安全特性

### 版本冲突检测
- 检查 Git 标签中是否存在相同版本
- 检查 npm registry 中是否存在相同版本
- 自动递增到安全的版本号

### 工作目录检查
- 确保没有未提交的更改
- 防止意外包含未完成的代码

### 预演模式
- 完整模拟发布过程
- 预览所有更改而不实际执行
- 安全测试发布配置

## 🔧 故障排除

### 常见问题

**Q: 发布失败，提示版本已存在**
```bash
# 检查远程版本
npm view your-package-name versions --json

# 使用预演模式检查版本号
npm run release:dry
```

**Q: 工作目录不干净**
```bash
# 查看未提交的更改
git status

# 提交更改
git add .
git commit -m "chore: 发布前的最后更改"
```

**Q: 测试失败**
```bash
# 单独运行测试
npm test

# 或跳过测试发布 (不推荐)
npm run release -- --skip-tests
```

**Q: 构建失败**
```bash
# 单独运行构建
npm run build

# 或跳过构建发布
npm run release -- --skip-build
```

### 回滚发布

如果发布后发现问题，可以：

```bash
# 删除错误的标签
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0

# 从 npm 撤回包 (24小时内)
npm unpublish your-package-name@1.2.0
```

## 📚 最佳实践

1. **🧪 发布前测试** - 始终在发布前运行完整的测试套件
2. **📝 清晰的提交信息** - 使用语义化的提交信息以生成更好的 changelog
3. **🏃 使用预演模式** - 重要发布前先运行 dry-run 模式
4. **📋 检查依赖** - 确保所有依赖都是最新且兼容的
5. **🔒 权限管理** - 确保有正确的 npm 发布权限
6. **📚 文档同步** - 发布新版本时同步更新文档

## 🤝 贡献指南

如果您想改进发包脚本：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加惊人的功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

💡 **提示**: 使用 `npm run release:dry` 来安全地测试发布流程！ 