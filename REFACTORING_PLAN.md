# Blade 项目最终架构设计与协作方案

本文档根据项目设计者的最终构想，为 Blade 项目量身定制。方案旨在明确 `packages/cli` 和 `packages/core` 两个功能丰富的包之间的职责与协作模式，以构建一个健壮、可维护且高度协同的系统。

## 一、重构实施核心原则

为确保本次大规模重构的成功，整个过程将严格遵循以下三大核心原则：

### 1. 测试驱动开发 (Test-Driven Development)
所有代码的迁移和重构都必须在测试的保护下进行。我们将采用经典的“红-绿-重构”循环来指导每一步操作：首先为目标功能编写失败的测试（红），然后迁移或实现代码使测试通过（绿），最后在测试保护下优化代码（重构）。

### 2. 优先复用现有代码 (Prioritize Reuse)
我们将优先利用 `src/` 目录下现有的成熟代码（如 Agent、组件、服务、工具等），通过移动、适配和重构的方式，将其整合进新的 `packages/cli` 和 `packages/core` 架构中，避免不必要的重复开发，确保核心逻辑的延续性。

### 3. 持续清理废旧代码 (Maintain Cleanliness)
在重构过程中，我们会主动识别并删除所有不再被新架构使用的旧代码文件、组件和 `package.json` 中的依赖项。在一个模块被完全迁移和验证后，其在 `src/` 下的旧文件将被移除，以保证最终代码库的整洁性。

---

## 二、核心设计原则：应用层(CLI)与服务层(Core)分离

我们将严格遵循经典分层应用架构，定义两个包的核心角色：

*   **`packages/cli` (应用层 / Application Layer)**
    *   **角色**: 系统的 **主入口** 和 **用户交互中心**。
    *   **职责**:
        1.  **解析用户意图**: 通过 `commands` 模块理解用户输入的命令和参数。
        2.  **编排业务流程**: `cli/services` 负责调用 `core` 中的一个或多个服务，来完成一个完整的用户功能（例如，“执行一次完整的代码审查”流程）。
        3.  **管理用户状态与UI**: 处理界面渲染、用户身份认证、用户个人设置等。
    *   **它关心的是“用户需要什么”以及“如何一步步引导用户完成任务”。**

*   **`packages/core` (服务与领域层 / Service & Domain Layer)**
    *   **角色**: 系统的 **核心业务逻辑** 和 **数据处理中心**。
    *   **职责**:
        1.  **提供原子服务**: `core/services` 提供独立的、可重用的业务能力（如 `gitService`, `fileSystemService`）。
        2.  **执行核心算法**: `core/core` 包含聊天、内容生成、工具调度等核心的、与UI无关的算法和逻辑。
        3.  **管理系统状态**: 负责聊天记录、核心存储、遥测等。
    *   **它关心的是“如何可靠地完成一个具体的业务操作”。**

## 三、两大包的协作模式

`cli` 层永远是主动调用方，`core` 层是被动执行方。它们之间通过 `core` 暴露的公共 API 进行通信。

**示例：一个 `review` 任务的执行流程 (在会话式 REPL 模型下)**

1.  **用户输入 (User Input)**: 在 `blade` 的持续性对话窗口中，用户输入一个模糊或明确的指令，例如 `review my code` 或 `/review`。

2.  **CLI (解析与启动 / Parse & Initiate)**:
    *   `cli/ui/App.tsx` 捕获用户输入。
    *   `cli` 的应用服务识别出这是一个“代码审查”的意图。
    *   它 **启动审查工作流**，第一步是调用 `core` 的 `gitService.getChangedFiles()` 方法来获取待审查的文件列表。

3.  **Core (获取数据 / Fetch Data)**:
    *   `core` 的 `gitService` 执行 `git diff` 等操作，将变更的文件列表返回给 `cli`。

4.  **CLI (交互式呈现 / Interactive Presentation)**:
    *   `cli` 收到文件列表后，**并不会直接打印**。
    *   它会在 UI 中渲染一个 **交互式组件**（例如一个带复选框的文件列表）。
    *   同时，它可能会调用 `core` 的聊天功能，让 AI 生成一句引导性的话术，例如：“我发现了以下 3 个文件有变更，您希望我审查全部，还是只审查您选中的文件？”

5.  **用户选择 (User Selection)**:
    *   用户在 `cli` 的交互式 UI 中勾选文件，或者直接输入 “全部”、“第一个” 等自然语言指令。

6.  **CLI (编排核心分析 / Orchestrate Analysis)**:
    *   `cli` 的应用服务根据用户的选择，确定最终要审查的文件列表。
    *   它 **循环或并发地** 调用 `core` 的 `contentGenerator.generateReview(fileContent)` 方法，并可能在界面上显示一个加载动画，提示“正在审查 `file.ts`...”。

7.  **Core (执行分析 / Execute Analysis)**:
    *   `core` 的 `contentGenerator` 针对每个文件内容，与 LLM 进行通信，获取结构化的审查结果（例如，包含问题描述、建议代码、严重等级的 JSON 对象）。

8.  **CLI (格式化报告 / Format & Report)**:
    *   `cli` 接收到所有文件的审查结果后，使用 `cli/ui` 的组件（如 `Card`, `List`, `CodeBlock` 等）将这些结构化数据渲染成一个清晰、美观的审查报告，最终展示在对话窗口中。

## 四、核心交互模型：会话式 REPL (Read-Eval-Print Loop)

根据产品的核心定位，Blade 不应是传统的“一次性”命令工具，而是一个 **会话式交互应用**。当用户输入 `blade` 后，系统将启动并进入一个持续运行的对话窗口，后续所有交互都在此窗口内以对话形式完成。

此交互模型完美契合我们设计的分层架构：

*   **`cli` 包** 作为 **REPL 的宿主 (Host)**，其 `React/Ink` 技术栈将负责渲染和管理这个持久化的、状态丰富的终端UI。
*   **`core` 包** 作为 **REPL 的评估器 (Evaluator)**，它接收 `cli` 传来的用户输入，执行相应的逻辑，然后返回结果，无需关心UI的任何细节。

### 实现要点

1.  **状态管理**: `cli` 包需要引入一个轻量级的状态管理器（如 **Zustand**），用于管理整个会话的状态，包括但不限于聊天记录、应用是否繁忙、当前用户输入等。
2.  **应用循环**: `cli/ui/App.tsx` 将作为主组件，负责渲染整个UI，并处理用户的输入事件。当用户提交输入后，`App.tsx` 负责调用 `core` 的相应服务，并在收到返回结果后更新状态，触发UI的重新渲染，从而形成一个完整的“读取-评估-打印”循环。
3.  **命令处理**: 在此模式下，支持两种命令形式：
    *   **自然语言**: 用户直接输入任务（如“帮我重构 a.ts”），由 `core` 的语言模型进行意图理解和工具调用。
    *   **斜杠命令**: `cli` 层可以拦截以 `/` 开头的特殊命令（如 `/clear`, `/help`），用于执行精确的、非AI驱动的客户端操作。

## 五、关键模块重构方案

为实现上述协作模式，对存在职责重叠的模块进行如下划分：

#### 1. 配置系统 (Config System)

采用 **分层合并** 的策略，明确配置的所有权。

*   **`core/config`**:
    *   `models.ts`: **定义所有配置的 TypeScript 接口**（例如 `IModelSettings`）。这是“契约”。
    *   `config.ts`: **提供系统级的默认配置**（例如，默认的 API 超时时间、默认的模型名称）。
*   **`cli/config`**:
    *   **作为配置的“所有者”和“最终解释者”**。
    *   它 `import` `core` 的配置接口和默认值。
    *   它负责读取所有用户文件（`auth.ts`, `settings.ts` 等）。
    *   它将用户配置与 `core` 的默认配置进行 **合并（Merge）**，生成最终的运行时配置。
    *   在应用启动时，由 `cli` 将这个最终配置 **注入** 到 `core` 的初始化模块中。

#### 2. 服务层 (Service Layer)

这是最能体现分层思想的地方，两个 `services` 目录的职责完全不同。

*   **`cli/services` (应用服务)**:
    *   **职责**: **流程编排**。`CommandService` 和各种 `Loader` 留在这里，负责“加载并准备执行命令”这个应用流程。
*   **`core/services` (领域服务)**:
    *   **职责**: 提供 **可重用的、独立的业务能力**。`fileSystemService`, `gitService`, `chatRecordingService` 封装了与特定领域相关的底层操作。

#### 3. 工具函数 (Utils)

为避免混淆，进行如下划分：

*   **`core/utils`**:
    *   **作为所有底层、可重用工具函数的主要存放地**。`gitUtils.ts`, `fileUtils.ts` 的具体实现应放在这里。
*   **`cli/utils`**:
    *   **应保持轻量**，只存放与 `cli` 应用本身强相关的工具（例如，格式化终端输出的函数）。
    *   **建议**: `cli` 中不应再有 `gitUtils.ts`。如果 `cli` 需要 Git 功能，它应该直接调用 `core/services/gitService.ts` 提供的服务，而不是 `core` 的底层 `utils`。这能更好地实现封装。

## 六、Core 包的公共 API

此原则依然至关重要。`core` 包必须通过其主入口文件 `packages/core/src/index.ts` 对外暴露一个稳定且明确的 API。`cli` 只能通过这个 API 与 `core` 交互，严禁任何深层导入，以此作为架构的防火墙。

## 七、总结

本方案完全采纳了您为 `cli` 和 `core` 设定的功能完备的结构，并通过引入经典的“应用层-服务层”分层架构，明确了它们各自的职责和协作模式。

*   **职责清晰**: `cli` 负责用户交互与流程编排，`core` 负责核心业务逻辑与能力实现。
*   **高度协同**: `cli` 作为指挥官，`core` 作为精英部队，协同完成复杂任务。
*   **健壮且可维护**: 清晰的边界和单向依赖使得系统更易于理解、测试和扩展。

该方案将为您设想的强大架构提供清晰、可行、专业的实施路径。

## 八、收尾工作：同步更新文档

在所有核心代码重构完成后，必须执行此最终步骤，以确保代码与文档的一致性。

### 目标
全面审查并更新 `docs/` 目录下的所有相关文档，确保其准确反映新的分层架构、API、交互模型和工作流程。

### 关键更新项
- **架构文档**: 更新 `docs/architecture.md` 和 `docs/AGENT_ARCHITECTURE.md`，反映新的 `cli` 和 `core` 分层设计。
- **API 参考**: 更新 `docs/API.md`，包含 `core` 包暴露的公共 API 和 `cli` 的主要组件接口。
- **命令参考**: 修改 `docs/COMMANDS.md` 中的命令示例，以符合新的“会话式 REPL”交互模型。
- **配置文档**: 更新 `docs/CONFIGURATION.md`，说明新的配置加载和管理流程。
- **侧边栏**: 检查并更新 `docs/_sidebar.md`，确保所有链接有效且指向最新的文档结构。
- **规范符合性**: 所有文档更新都必须保持与现有 `docsify` 站点兼容的 Markdown 格式。

---

## 附录：关键问题澄清与技术方案

### 1. 现有架构与目标架构的差距分析

当前 `src/` 目录下的代码已具备新架构的雏形，重构的核心是**“迁移、重构、归位”**，而非完全重写。迁移路径如下：

- **`src/agent/*`**: `Agent.ts` 降级为协调器；`ComponentManager`、`ContextComponent`、`ToolComponent` 等核心组件将迁移并升级为 `packages/core` 中的核心服务。
- **`src/config/*`**: `UnifiedConfigManager` 等逻辑将整体迁移至 `packages/core/src/config`，成为配置引擎。
- **`src/context/*`, `src/llm/*`, `src/tools/*`, `src/mcp/*`**: 作为纯粹的核心能力，直接平移到 `packages/core` 的对应目录中。
- **`src/commands/*`**: 命令的**定义**和**UI交互**保留在 `packages/cli`，其**业务逻辑**将被剥离，转为调用 `core` 的服务。
- **`src/ui/*`**: 作为 UI 资产，整体迁移至 `packages/cli/src/ui`。

**API 重构**: `packages/core/src/index.ts` 将成为 `core` 包的**唯一出口 (Facade)**，导出各个独立的服务（如 `ChatService`, `ToolService`）和类型，`cli` 包将只通过此入口消费 `core` 的能力。

### 2. 具体技术实施细节

*   **状态管理 (State Management)**:
    *   **决策**: 根据您的要求，我们将**使用 React 原生的 Context API** 进行 `cli` 的状态管理，不引入额外的状态管理库（如 Zustand），以保持项目依赖的简洁性。
    *   **实施**: 我们将在 `packages/cli/src/ui/contexts/` 目录下创建一个 `SessionContext.tsx`。此 Context 将在 `App.tsx` 中作为 Provider 包裹整个应用，并提供会话状态（如 `messages`, `isThinking`）和更新状态的 dispatch 函数。各UI组件通过 `useContext(SessionContext)` Hook 来消费和更新状态。

*   **配置系统 (Injection Mechanism)**:
    *   **Core 层**: `packages/core/src/config/` 负责定义所有配置项的 **Schema (使用 Zod)** 和 **默认值**。它提供一个 `createConfig(layers)` 函数，但它自身**不执行任何文件 I/O**。
    *   **CLI 层**: 应用启动时，`packages/cli` 负责**执行 I/O**，读取环境变量和所有配置文件。
    *   **注入机制**: `cli` 将读取到的多个配置层对象作为参数，调用 `core` 的 `createConfig` 函数，生成一个最终的、合并后的配置对象。这个对象随后在初始化 `core` 引擎时被**注入**进去。

*   **错误处理 (Cross-layer Strategy)**:
    *   **Core 层**: 抛出**结构化的、自定义的错误类**（如 `ToolExecutionError`），包含机器可读的 `code` 和用户友好的 `message`，不暴露内部堆栈信息。
    *   **CLI 层**: 在调用 `core` 的 API 时，使用 `try...catch` 捕获这些结构化错误。根据 `error.code` 和 `error.message`，使用 UI 组件（如 Toast）向用户显示清晰的错误提示。

### 3. 迁移策略的具体步骤

我们将采用**由内而外 (Bottom-up)**的迁移策略，确保主干分支在重构期间始终稳定。

1.  **Phase 1 (基础建设)**: 迁移 `utils`, `types`, `config schemas` 等底层无依赖模块到 `packages/core`。
2.  **Phase 2 (核心引擎)**: 迁移 `llm`, `tools`, `context` 等核心服务到 `packages/core`，并完善其单元和集成测试，使其成为一个功能完整的独立包。
3.  **Phase 3 (应用层对接)**: 重构 `packages/cli`，使其完全依赖 `packages/core` 的公共 API。这是变更规模最大的阶段。
4.  **Phase 4 (清理)**: 在新架构稳定运行后，安全地删除根目录下的 `src/` 文件夹和相关依赖。

**测试与回滚**: 所有重构都在 `feature/refactoring` 分支上进行。TDD 将贯穿始终，确保每个迁移模块的功能正确性。在 Phase 4 完成前，旧的 `src` 代码可作为参考和快速回滚的基线。

### 4. 性能和安全考虑

*   **REPL 内存管理**:
    *   **核心**: `core` 的 `ContextManager` 将通过**上下文压缩**和**消息数量限制**来控制内存占用。
    *   **UI**: `cli` 将采用**虚拟滚动**技术，仅渲染视口内的消息，避免大量 DOM 元素导致性能下降。
    *   **用户操作**: 提供 `/clear` 命令允许用户手动清理会话，释放内存。

*   **认证与授权 (AuthN & AuthZ)**:
    *   **认证**: 由 `cli` 层负责读取和管理 API Key，然后安全地将其注入到 `core` 引擎的初始化配置中。
    *   **授权**: `core` 的 `ToolService` 将包含一个简单的权限检查机制。`cli` 可根据用户身份，在初始化 `core` 时传入一个 `role` (角色)，`ToolService` 在执行工具前会校验该 `role` 是否拥有足够权限。

*   **跨包通信性能**:
    *   由于是本地 Monorepo，函数调用开销极低。性能优化的关键在于**避免传递大数据块**。我们将遵循“传递指令，而非数据”的原则，例如，由 `core` 的服务根据 `cli` 传来的文件路径自行读取文件内容。
