# Changelog

All notable changes to this project will be documented in this file.


## [1.2.4] - 2025-06-06

### ✨ 新功能

- 重构工具使用ConfirmableToolBase基类，统一用户确认机制 (f833a51)

### 🔧 其他更改

- 清理不必要的代码和文件，更新README - 删除command-confirmation.ts工具（已被ConfirmableToolBase替代） - 移除所有对commandConfirmationTools的引用 - 更新工具数量从27个减少到25个 - 重构README文档，强调新的ConfirmableToolBase统一确认机制 (e7b9854)


## [1.2.3] - 2025-06-04


## [1.2.2] - 2025-06-03

### ✨ 新功能

- 新增配置管理功能，支持设置和切换LLM提供商 (a05dd47)

### 🐛 问题修复

- 将变量声明从let更改为const，以提高代码可读性和安全性 (4dcd781)


## [1.2.1] - 2025-06-03

### ✨ 新功能

- 新增自动化发包功能并完善发布流程文档 (77d5533)
- 新增命令确认工具，增强安全交互功能 (222c67f)
- 新增流式输出功能并优化交互式聊天体验 (c659097)

### 📝 文档更新

- 优化安装说明和使用方式文档 (9507232)
- 更新README.md中的API密钥配置说明和安全注意事项 (57331b2)

### ♻️ 代码重构

- 优化工具模块代码结构和导入语句 (05e8865)
- 项目重命名为Blade并调整文档和脚本 (3a64e6c)

### 🔧 其他更改

- 更新版本号并修复仓库URL格式 (2887d4c)
- 优化LLM聊天提示信息和输入方式 (f0fa1ab)
- 重命名项目为blade-ai并更新安装说明 (166733d)

