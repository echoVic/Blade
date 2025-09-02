# Blade 项目重构详细执行计划

本文档将 `REFACTORING_PLAN.md` 中的宏观设计分解为具体、可执行的步骤。整个过程分为三个主要阶段，采用“由内而外”的策略，首先构建一个独立的 `core` 包，然后改造 `cli` 包以消费 `core`，最后进行清理和文档更新。

所有开发工作应在 `feature/refactoring` 分支上进行。

---

## Phase 1: `packages/core` 基础建设 (构建核心引擎)

**目标**: 将所有核心业务逻辑、领域服务和底层工具迁移到一个全新的、独立的、经过充分测试的 `packages/core` 包中。此阶段完成后，`core` 包应可作为独立的 NPM 包发布。


### 步骤 1.1: 初始化 `packages/core`

-   [ ] **创建目录结构**:
    -   `packages/core/src/`
    -   `packages/core/src/config`
    -   `packages/core/src/context`
    -   `packages/core/src/llm`
    -   `packages/core/src/mcp`
    -   `packages/core/src/services`
    -   `packages/core/src/tools`
    -   `packages/core/src/types`
    -   `packages/core/src/utils`
    -   `packages/core/tests/`
-   [ ] **创建配置文件**:
    -   `packages/core/package.json`: 定义包名 (`@blade/core`)、依赖项 (如 `zod`) 和脚本。
    -   `packages/core/tsconfig.json`: 配置 TypeScript 编译选项。
    -   `packages/core/vitest.config.ts`: 配置单元测试和集成测试。
-   [ ] **定义主入口**: 创建 `packages/core/src/index.ts`，作为 `core` 包唯一的公共 API 出口。

### 步骤 1.2: 迁移底层模块 (Bottom-up)

-   [ ] **迁移 Types**: 将 `src/types` 下的所有共享类型定义移动到 `packages/core/src/types`。
-   [ ] **迁移 Utils**:
    -   将 `src/utils` 下的通用工具函数 (`fileUtils.ts`, `gitUtils.ts` 等) 移动到 `packages/core/src/utils`。
    -   为每个工具函数编写或迁移单元测试到 `packages/core/tests/utils`。
-   [ ] **重构配置系统**:
    -   在 `packages/core/src/config/models.ts` 中使用 `Zod` 重新定义所有配置的 Schema。
    -   将 `src/config` 中的系统级默认配置迁移到 `packages/core/src/config/defaults.ts`。
    -   在 `packages/core/src/config/index.ts` 中实现 `createConfig(layers)` 函数，用于合并配置层，此函数不执行任何 I/O 操作。
    -   为配置合并逻辑编写单元测试。

### 步骤 1.3: 迁移核心服务与逻辑

-   [ ] **迁移纯逻辑模块**:
    -   将 `src/llm`, `src/mcp`, `src/tools`, `src/context` 的全部内容直接平移到 `packages/core/src/` 下的对应目录。
    -   为这些模块的关键逻辑（如 `ContextManager` 的压缩策略）编写或迁移测试。
-   [ ] **迁移并重构领域服务**:
    -   将 `fileSystemService`, `gitService`, `chatRecordingService` 等从 `src/` 迁移到 `packages/core/src/services`。
    -   将它们重构为独立的、可重用的类或对象，确保它们不依赖任何 `cli` 或 UI 层。
    -   为每个服务编写详尽的单元和集成测试。

### 步骤 1.4: 定义并审查公共 API

-   [ ] **明确导出**: 在 `packages/core/src/index.ts` 中，显式导出所有供 `cli` 使用的服务、类型、函数和 Schema。
-   [ ] **添加 TSDoc**: 为所有导出的 API 添加清晰的 TSDoc 注释，说明其用途、参数和返回值。
-   [ ] **团队审查**: 进行一次 API 设计审查，确保其清晰、稳定且满足 `cli` 层的需求。

### 步骤 1.5: `core` 包接口集成测试

-   [ ] **编写 API 测试用例**: 在 `packages/core/tests/api` 目录下，编写集成测试来直接调用从 `index.ts` 导出的服务。
-   [ ] **测试服务间协作**: 验证核心服务组合在一起时能否正常工作。例如，调用 `GitService` 获取文件内容，然后将其传递给 `ChatService` 进行分析，并断言结果是否符合预期。
-   [ ] **模拟不同配置**: 测试在注入不同的配置时，`core` 引擎的行为是否符合预期。
-   [ ] **确保契约稳固**: 这些测试是 `cli` 和 `core` 之间交互契约的最终保证，必须在 `Phase 1` 结束前全部通过。

---

## Phase 2: `packages/cli` 应用层改造 (对接核心引擎)

**目标**: 将 `packages/cli` 重构为一个纯粹的应用层，负责用户交互、状态管理和流程编排。它将通过 `core` 包的公共 API 来完成所有业务逻辑。

### 步骤 2.1: 准备 `packages/cli`

-   [ ] **更新依赖**: 在 `packages/cli/package.json` 中，移除对已迁移到 `core` 的库的直接依赖，并添加对 `@blade/core` 的工作区依赖 (`"workspace:*"`).
-   [ ] **调整目录结构**: 确认 `src/ui`, `src/services`, `src/config`, `src/commands` 等目录存在。

### 步骤 2.2: 实现会话式 REPL (Read-Eval-Print Loop)

-   [ ] **迁移 UI 组件**: 将 `src/ui` 的所有 React/Ink 组件迁移到 `packages/cli/src/ui`。
-   [ ] **实现状态管理**:
    -   创建 `packages/cli/src/ui/contexts/SessionContext.tsx`。
    -   在 Context 中定义会话状态（`messages`, `isThinking`, `input` 等）和 `dispatch` 函数。
    -   使用 `SessionProvider` 包裹 `packages/cli/src/ui/App.tsx`。
-   [ ] **构建主应用循环**:
    -   重构 `App.tsx`，使其成为 REPL 的主界面。
    -   实现用户输入捕获、提交的逻辑。
    -   在用户提交后，调用相应的 `cli` 服务来处理命令。

### 步骤 2.3: 对接 `@blade/core`

-   [ ] **实现配置注入**:
    -   在 `packages/cli/src/config` 中实现读取所有配置文件（`settings.json` 等）和环境变量的 I/O 逻辑。
    -   在应用启动时，调用 `core` 的 `createConfig()` 函数，并将读取到的配置层作为参数传入。
    -   将最终生成的配置对象注入到 `core` 服务的初始化过程中。
-   [ ] **重构命令处理**:
    -   **斜杠命令**: 在 `cli` 层直接实现 `/help`, `/clear` 等客户端命令。
    -   **自然语言**: 获取用户输入后，调用 `core` 的 `ChatService` 或其他相关服务进行处理。
-   [ ] **重构应用服务 (`cli/services`)**:
    -   改造 `CommandService` 等，使其成为**流程编排器**。
    -   示例 (`review` 命令):
        1.  调用 `core.gitService.getChangedFiles()`。
        2.  使用 `cli/ui` 组件渲染交互式文件列表。
        3.  等待用户选择，然后循环调用 `core.contentGenerator.generateReview()`。
        4.  接收 `core` 返回的结构化数据，并使用 `cli/ui` 组件格式化成报告。
-   [ ] **实现错误处理**:
    -   在 `cli` 层所有调用 `core` API 的地方，使用 `try...catch` 结构。
    -   根据 `core` 抛出的自定义错误类型，在 UI 中显示用户友好的错误提示（如 Toast 或消息卡片）。

---

## Phase 3: 端到端 (E2E) 功能完整性测试

**目标**: 验证重构后的应用程序在功能上与重构前完全一致。通过模拟真实用户的**会话式交互**，确保所有核心工作流程在新架构下都能正确、稳定地运行。**此阶段是决定是否可以安全删除旧代码的最终关卡。**

### 步骤 3.1: 建立基线会话 (Characterization Tests)

-   [ ] **识别关键会话场景**: 定义 5-10 个最核心的连续交互场景。例如：
    1.  **上下文感知审查**: 先问 `"what files have changed?"`，然后根据返回结果，在下一步指令中说 `"ok, review the first file"`。
    2.  **多步代码生成**: 先指令 `"create a file named 'test.js'"`，然后 `"add a function to it called 'myFunc' that returns true"`。
    3.  **配置与状态检查**: 运行一个命令，然后使用 `/status` 或类似命令检查内部状态，验证其一致性。
-   [ ] **编写 E2E 会话测试脚本**:
    -   **采用正确的测试工具**: 使用 Node.js 的 `child_process` 模块来启动 `blade` 作为一个子进程。
    -   **模拟交互**: 测试脚本需要能够向子进程的 `stdin` 流中写入多条命令，并异步地从 `stdout` 流中读取和解析结果。
    -   **断言会话状态**: 验证在连续的交互中，应用的响应是正确的，且上下文状态得到了维持。
-   [ ] **在 `main` 分支运行**: 在重构开始前，在 `main` 分支上运行所有 E2E 会话测试并保存结果日志。这份结果是“黄金标准”。

### 步骤 3.2: 在新架构上验证功能对等性

-   [ ] **在 `feature/refactoring` 分支运行 E2E 测试**: 在 Phase 2 完成后，在重构分支上运行同样的 E2E 会话测试套件。
-   [ ] **对比结果**: 将测试输出的日志与之前保存的“黄金标准”进行比对。
-   [ ] **修复回归**: 识别并修复所有失败的测试，直到新架构的行为与旧架构完全一致。

---

## Phase 4: 清理与文档同步

**目标**: 在新架构稳定运行后，移除所有废旧代码和依赖，并更新所有相关文档，确保代码库的整洁和文档的一致性。

### 步骤 4.1: 代码与依赖清理

-   [ ] **删除旧代码**: 在 `feature/refactoring` 分支充分测试并确认新架构稳定后，安全删除根目录下的 `src/` 文件夹。
-   [ ] **清理根依赖**: 审查并清理根 `package.json`，移除不再需要的依赖项。
-   [ ] **验证工作区**: 确保 `pnpm-workspace.yaml` 配置正确，`pnpm install` 能正常工作。

### 步骤 4.2: 文档全面更新

-   [ ] **架构文档**: 更新 `docs/architecture.md` 和 `docs/AGENT_ARCHITECTURE.md`，详细描述新的 `cli/core` 分层模型。
-   [ ] **API 参考**: 基于 `packages/core/src/index.ts` 的导出，更新 `docs/API.md`。
-   [ ] **命令参考**: 修改 `docs/COMMANDS.md` 中的示例，以匹配新的会話式 REPL 交互方式。
-   [ ] **配置文档**: 更新 `docs/CONFIGURATION.md`，解释新的分层配置系统和注入机制。
-   [ ] **快速开始**: 更新 `docs/QUICK_START.md`，反映新的安装和使用流程。
-   [ ] **链接检查**: 检查并修复 `docs/_sidebar.md` 中的所有链接，确保没有死链。
-   [ ] **格式校验**: 确保所有文档更新都与 `docsify` 站点的格式兼容。
