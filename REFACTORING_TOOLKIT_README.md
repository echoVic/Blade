# Blade 重构工具包使用指南

## 📋 概述

本工具包是为 Blade Monorepo 重构项目专门设计的，包含了帮助团队理解和执行重构计划的所有必要工具和文档。

## 📁 目录结构

```
blade/
├── REFACTORING_MASTER_PLAN.md      # 详细的重构总体规划
├── REFACTORING_EXECUTIVE_SUMMARY.md # 管理层执行摘要
├── scripts/
│   └── refactoring-toolkit.js      # 重构工具命令行接口
├── REFACTORING_TOOLKIT_README.md   # 本文件
├── config/refactoring/             # 重构配置文件
├── monitoring/reports/             # 监控和报告
└── docs/refactoring/               # 重构相关文档
```

## 🚀 快速开始

### 1. 初始化重构项目

```bash
# 为重构工具添加执行权限
chmod +x scripts/refactoring-toolkit.js

# 初始化重构项目
node scripts/refactoring-toolkit.js init
```

此命令会创建必要的目录结构和配置文件。

### 2. 运行健康检查

```bash
# 检查项目当前状态
node scripts/refactoring-toolkit.js check
```

### 3. 查看重构计划

```bash
# 查看第一阶段详细计划
node scripts/refactoring-toolkit.js plan 1

# 可选阶段:
# 1: 架构重构 (4周)
# 2: 安全加固 (3周)
# 3: 性能优化 (4周)
# 4: 测试体系建设 (3周)
# 5: 文档和运维 (2周)
```

## 📚 核心文档

### 详细重构计划
- **文件**: `REFACTORING_MASTER_PLAN.md`
- **内容**: 完整的16周重构路线图，包含详细的阶段划分、任务分解、资源分配和风险管理
- **读者**: 开发团队、项目经理、架构师

### 执行摘要
- **文件**: `REFACTORING_EXECUTIVE_SUMMARY.md`
- **内容**: 为管理层准备的简化摘要，包括价值主张、预算估算、投资回报分析
- **读者**: 管理层、投资人、业务负责人

## 🛠️ 重构工具命令

### 命令概览

```bash
# 显示所有可用命令
node scripts/refactoring-toolkit.js help

# 初始化项目环境
node scripts/refactoring-toolkit.js init

# 项目健康检查
node scripts/refactoring-toolkit.js check

# 生成阶段计划
node scripts/refactoring-toolkit.js plan [1-5]

# 显示项目指标
node scripts/refactoring-toolkit.js metrics

# 设置重构环境
node scripts/refactoring-toolkit.js setup

# 运行安全审计
node scripts/refactoring-toolkit.js audit

# 生成项目报告
node scripts/refactoring-toolkit.js report
```

### 常用命令详解

#### 1. 项目初始化
```bash
node scripts/refactoring-toolkit.js init
```
- 创建项目目录结构
- 生成配置文件
- 初始化里程碑记录

#### 2. 健康检查
```bash
node scripts/refactoring-toolkit.js check
```
- 验证项目结构完整性
- 检查必要的配置文件
- 评估准备状态

#### 3. 阶段计划生成
```bash
# 查看第一阶段（架构重构）计划
node scripts/refactoring-toolkit.js plan 1

# 查看第二阶段（安全加固）计划
node scripts/refactoring-toolkit.js plan 2
```

#### 4. 安全审计
```bash
node scripts/refactoring-toolkit.js audit
```
- 显示已识别的安全问题
- 分类展示风险等级
- 提供修复建议

#### 5. 报告生成
```bash
node scripts/refactoring-toolkit.js report
```
- 生成 JSON 格式的详细报告
- 创建人类可读的文本报告
- 存储到 monitoring/reports/ 目录

## 📊 项目配置文件

初始化后会创建以下配置文件:

```
config/refactoring/
├── project.json     # 项目基本信息和配置
├── milestones.json  # 里程碑定义
└── .refactoring-env # 环境变量文件
```

### project.json 结构
```json
{
  "projectName": "blade-refactoring",
  "version": "1.0.0",
  "startDate": "2025-08-29T00:00:00.000Z",
  "phases": [
    {
      "id": "architecture",
      "name": "架构重构",
      "duration": 4,
      "goals": ["拆分Agent类", "实现管理器分离"],
      "keyDeliverables": ["重构后的核心架构"]
    }
  ],
  "team": {
    "architect": 1,
    "frontend": 1,
    "backend": 2
  },
  "budget": 630000,
  "status": "initialized"
}
```

## 🔧 团队协作指南

### 1. 阶段负责人制

每个重构阶段应指定明确的负责人:
- **阶段1 (架构重构)**: 架构师
- **阶段2 (安全加固)**: 安全工程师
- **阶段3 (性能优化)**: 后端工程师 + 前端工程师
- **阶段4 (测试体系)**: QA 工程师
- **阶段5 (文档运维)**: 技术写作者 + 运维工程师

### 2. 每周检查机制

```bash
# 每周一运行健康检查
node scripts/refactoring-toolkit.js check

# 生成周报
node scripts/refactoring-toolkit.js report
```

### 3. 里程碑追踪

```bash
# 查看当前里程碑状态
cat config/refactoring/milestones.json
```

## 🚨 关键注意事项

### 1. 向后兼容性

- 保持所有现有 API 接口不变
- 渐进式重构，避免破坏性变更
- 充分的回归测试覆盖

### 2. 安全优先

- 高风险安全问题必须优先修复
- 任何涉及安全的变更需双人审查
- 定期运行安全审计命令

### 3. 文档同步

- 代码变更时同步更新文档
- 重要决策需记录在案
- 用户面向的变更需更新用户文档

## 🔍 故障排除

### 常见问题

**Q: 无法运行工具命令**
A: 确保 Node.js 版本 >= 16，并为脚本添加执行权限

```bash
node --version
chmod +x scripts/refactoring-toolkit.js
```

**Q: 项目健康检查失败**
A: 根据失败项修复相应的项目配置

```bash
node scripts/refactoring-toolkit.js check
# 根据输出修复问题
```

**Q: 阶段计划生成异常**
A: 检查 phase 编号是否有效 (1-5)

```bash
node scripts/refactoring-toolkit.js plan 1  # 正确
node scripts/refactoring-toolkit.js plan 6  # 错误
```

## 📈 最佳实践

### 1. 每日工作流
```bash
# 1. 开始工作前检查项目状态
node scripts/refactoring-toolkit.js check

# 2. 工作中查看阶段计划
node scripts/refactoring-toolkit.js plan 1

# 3. 结束时生成报告
node scripts/refactoring-toolkit.js report
```

### 2. 团队沟通
- 每日站会时报告 milestone.json 进度
- 每周定期生成并讨论报告
- 重大变更前运行安全审计

### 3. 质量保证
- 每个阶段完成后运行完整测试
- 变更前后的性能对比
- 用户体验的回归验证

## 📞 支持和反馈

如遇到问题或有改进建议，请:

1. 检查现有文档是否有解决方案
2. 在团队会议中讨论
3. 提交 GitHub issue
4. 联系项目经理

---

**文档版本**: 1.0  
**最后更新**: 2025-08-29  
**作者**: Claude Architecture Team