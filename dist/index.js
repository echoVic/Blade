#!/usr/bin/env node

// src/index.ts
import chalk6 from "chalk";
import { Command } from "commander";

// src/commands/init.ts
import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
function initCommand(program2) {
  program2.command("init").description("\u521D\u59CB\u5316\u4E00\u4E2A\u65B0\u9879\u76EE").argument("[name]", "\u9879\u76EE\u540D\u79F0").option("-t, --template <template>", "\u4F7F\u7528\u7684\u6A21\u677F", "default").action(async (name, options) => {
    console.log(chalk.blue("\u{1F680} \u5F00\u59CB\u521D\u59CB\u5316\u9879\u76EE..."));
    if (!name) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "\u8BF7\u8F93\u5165\u9879\u76EE\u540D\u79F0:",
          default: "my-project"
        }
      ]);
      name = answers.projectName;
    }
    if (options.template === "default") {
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "template",
          message: "\u8BF7\u9009\u62E9\u9879\u76EE\u6A21\u677F:",
          choices: ["react", "vue", "node"]
        }
      ]);
      options.template = answers.template;
    }
    const projectPath = path.resolve(process.cwd(), name);
    if (fs.existsSync(projectPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: "confirm",
          name: "overwrite",
          message: `\u76EE\u5F55 ${name} \u5DF2\u5B58\u5728\uFF0C\u662F\u5426\u8986\u76D6?`,
          default: false
        }
      ]);
      if (!overwrite) {
        console.log(chalk.yellow("\u274C \u64CD\u4F5C\u5DF2\u53D6\u6D88"));
        return;
      }
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(projectPath, { recursive: true });
    const packageJson = {
      name,
      version: "0.1.0",
      description: `${name} project created by agent-cli`,
      type: "module",
      main: "index.js",
      scripts: {
        start: "node index.js"
      },
      keywords: [],
      author: "",
      license: "MIT"
    };
    fs.writeFileSync(
      path.join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
    fs.writeFileSync(
      path.join(projectPath, "index.js"),
      `console.log('Hello from ${name}!');
`
    );
    console.log(chalk.green(`\u2705 \u9879\u76EE ${name} \u5DF2\u6210\u529F\u521B\u5EFA!`));
    console.log(chalk.cyan(`\u6A21\u677F: ${options.template}`));
    console.log(chalk.cyan(`\u4F4D\u7F6E: ${projectPath}`));
    console.log("");
    console.log(chalk.yellow("\u63A5\u4E0B\u6765:"));
    console.log(`  cd ${name}`);
    console.log("  npm install");
    console.log("  npm start");
  });
}

// src/commands/llm.ts
import chalk2 from "chalk";
import inquirer2 from "inquirer";
function llmCommand(program2) {
  program2.command("llm").description("\u6D4B\u8BD5 LLM \u529F\u80FD").option("-p, --provider <provider>", "\u9009\u62E9 LLM \u63D0\u4F9B\u5546 (volcengine|qwen)", "qwen").option("-k, --api-key <key>", "API \u5BC6\u94A5").option("-m, --model <model>", "\u6307\u5B9A\u6A21\u578B").option("-s, --stream", "\u542F\u7528\u6D41\u5F0F\u8F93\u51FA", false).action(async (options) => {
    console.log(chalk2.blue("\u{1F916} \u542F\u52A8 LLM \u6D4B\u8BD5..."));
    try {
      if (!isProviderSupported(options.provider)) {
        console.log(chalk2.red(`\u274C \u4E0D\u652F\u6301\u7684\u63D0\u4F9B\u5546: ${options.provider}`));
        console.log(chalk2.yellow("\u652F\u6301\u7684\u63D0\u4F9B\u5546: qwen, volcengine"));
        return;
      }
      const providerConfig = getProviderConfig(options.provider);
      let apiKey = options.apiKey || providerConfig.apiKey;
      if (!apiKey || apiKey.startsWith("sk-") && apiKey.length < 20) {
        const answers = await inquirer2.prompt([
          {
            type: "password",
            name: "apiKey",
            message: `\u8BF7\u8F93\u5165 ${options.provider} \u7684 API \u5BC6\u94A5:`,
            mask: "*"
          }
        ]);
        apiKey = answers.apiKey;
      }
      if (!apiKey) {
        console.log(chalk2.red("\u274C API \u5BC6\u94A5\u4E0D\u80FD\u4E3A\u7A7A"));
        return;
      }
      const model = options.model || providerConfig.defaultModel;
      const agent = new Agent({ debug: true });
      let llm;
      switch (options.provider) {
        case "volcengine":
          llm = new VolcEngineLLM({ apiKey }, model);
          break;
        case "qwen":
          llm = new QwenLLM({ apiKey }, model);
          break;
      }
      agent.registerComponent(llm);
      await agent.init();
      console.log(chalk2.green(`\u2705 ${options.provider} LLM \u521D\u59CB\u5316\u6210\u529F`));
      console.log(chalk2.gray(`\u4F7F\u7528\u6A21\u578B: ${model}`));
      console.log(chalk2.cyan('\u5F00\u59CB\u804A\u5929\uFF08\u8F93\u5165 "exit" \u9000\u51FA\uFF09:'));
      while (true) {
        const { message } = await inquirer2.prompt([
          {
            type: "input",
            name: "message",
            message: "\u4F60:"
          }
        ]);
        if (message.toLowerCase() === "exit") {
          break;
        }
        if (!message.trim()) {
          continue;
        }
        try {
          console.log(chalk2.gray("AI \u6B63\u5728\u601D\u8003..."));
          if (options.stream && llm.streamChat) {
            process.stdout.write(chalk2.green("AI: "));
            await llm.streamChat(
              {
                messages: [{ role: "user", content: message }]
              },
              (chunk) => {
                process.stdout.write(chunk);
              }
            );
            console.log();
          } else {
            const response = await llm.sendMessage(message);
            console.log(chalk2.green("AI:"), response);
          }
        } catch (error) {
          console.error(chalk2.red("\u274C \u8BF7\u6C42\u5931\u8D25:"), error);
        }
      }
      await agent.destroy();
      console.log(chalk2.green("\u2705 \u804A\u5929\u7ED3\u675F"));
    } catch (error) {
      console.error(chalk2.red("\u274C LLM \u6D4B\u8BD5\u5931\u8D25:"), error);
    }
  });
  program2.command("llm:models").description("\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u5217\u8868").option("-p, --provider <provider>", "\u9009\u62E9 LLM \u63D0\u4F9B\u5546 (volcengine|qwen)", "qwen").option("-k, --api-key <key>", "API \u5BC6\u94A5").action(async (options) => {
    try {
      if (!isProviderSupported(options.provider)) {
        console.log(chalk2.red(`\u274C \u4E0D\u652F\u6301\u7684\u63D0\u4F9B\u5546: ${options.provider}`));
        console.log(chalk2.yellow("\u652F\u6301\u7684\u63D0\u4F9B\u5546: qwen, volcengine"));
        return;
      }
      const providerConfig = getProviderConfig(options.provider);
      let apiKey = options.apiKey || providerConfig.apiKey;
      if (!apiKey || apiKey.startsWith("sk-") && apiKey.length < 20) {
        const answers = await inquirer2.prompt([
          {
            type: "password",
            name: "apiKey",
            message: `\u8BF7\u8F93\u5165 ${options.provider} \u7684 API \u5BC6\u94A5:`,
            mask: "*"
          }
        ]);
        apiKey = answers.apiKey;
      }
      let llm;
      switch (options.provider) {
        case "volcengine":
          llm = new VolcEngineLLM({ apiKey });
          break;
        case "qwen":
          llm = new QwenLLM({ apiKey });
          break;
      }
      console.log(chalk2.blue(`\u{1F50D} \u83B7\u53D6 ${options.provider} \u53EF\u7528\u6A21\u578B...`));
      const models = await llm.getModels();
      const defaultModel = providerConfig.defaultModel;
      console.log(chalk2.green(`\u2705 ${options.provider} \u53EF\u7528\u6A21\u578B:`));
      models.forEach((model, index) => {
        const isDefault = model === defaultModel;
        const marker = isDefault ? chalk2.yellow(" (\u9ED8\u8BA4)") : "";
        console.log(chalk2.cyan(`  ${index + 1}. ${model}${marker}`));
      });
    } catch (error) {
      console.error(chalk2.red("\u274C \u83B7\u53D6\u6A21\u578B\u5217\u8868\u5931\u8D25:"), error);
    }
  });
}

// src/commands/run.ts
import chalk5 from "chalk";

// src/agent/Agent.ts
import chalk3 from "chalk";
import * as events from "events";
import inquirer3 from "inquirer";
var Agent = class extends events.EventEmitter {
  /**
   * 创建 Agent 实例
   */
  constructor(options = {}) {
    super();
    this.components = /* @__PURE__ */ new Map();
    this.initialized = false;
    this.debug = options.debug || false;
    if (options.components) {
      options.components.forEach((component) => {
        this.registerComponent(component);
      });
    }
  }
  /**
   * 注册组件
   */
  registerComponent(component) {
    if (this.components.has(component.name)) {
      this.log("warn", `\u7EC4\u4EF6 "${component.name}" \u5DF2\u5B58\u5728\uFF0C\u5C06\u88AB\u8986\u76D6`);
    }
    this.components.set(component.name, component);
    this.log("info", `\u7EC4\u4EF6 "${component.name}" \u5DF2\u6CE8\u518C`);
  }
  /**
   * 获取已注册组件
   */
  getComponent(name) {
    return this.components.get(name);
  }
  /**
   * 初始化 Agent 及所有组件
   */
  async init() {
    if (this.initialized) {
      this.log("warn", "Agent \u5DF2\u7ECF\u521D\u59CB\u5316");
      return;
    }
    this.log("info", "\u521D\u59CB\u5316 Agent...");
    try {
      const entries = Array.from(this.components.entries());
      for (const [name, component] of entries) {
        this.log("info", `\u521D\u59CB\u5316\u7EC4\u4EF6: ${name}`);
        await component.init();
      }
      this.initialized = true;
      this.emit("initialized");
      this.log("success", "Agent \u521D\u59CB\u5316\u5B8C\u6210");
    } catch (error) {
      this.log("error", `\u521D\u59CB\u5316\u5931\u8D25: ${error}`);
      throw error;
    }
  }
  /**
   * 销毁 Agent 及所有组件
   */
  async destroy() {
    if (!this.initialized) {
      this.log("warn", "Agent \u5C1A\u672A\u521D\u59CB\u5316");
      return;
    }
    this.log("info", "\u9500\u6BC1 Agent...");
    try {
      const componentsArray = Array.from(this.components.entries());
      for (let i = componentsArray.length - 1; i >= 0; i--) {
        const [name, component] = componentsArray[i];
        this.log("info", `\u9500\u6BC1\u7EC4\u4EF6: ${name}`);
        await component.destroy();
      }
      this.initialized = false;
      this.emit("destroyed");
      this.log("success", "Agent \u5DF2\u9500\u6BC1");
    } catch (error) {
      this.log("error", `\u9500\u6BC1\u5931\u8D25: ${error}`);
      throw error;
    }
  }
  /**
   * 处理用户输入
   */
  async handleInput(prompt) {
    const answer = await inquirer3.prompt([
      {
        type: "input",
        name: "userInput",
        message: prompt
      }
    ]);
    this.emit("userInput", answer.userInput);
    return answer.userInput;
  }
  /**
   * 处理输出到用户
   */
  output(message, type = "info") {
    let formattedMessage;
    switch (type) {
      case "success":
        formattedMessage = chalk3.green(message);
        break;
      case "warn":
        formattedMessage = chalk3.yellow(message);
        break;
      case "error":
        formattedMessage = chalk3.red(message);
        break;
      default:
        formattedMessage = chalk3.blue(message);
    }
    console.log(formattedMessage);
    this.emit("output", { message, type });
  }
  /**
   * 内部日志方法
   */
  log(type, message) {
    if (this.debug || type === "error") {
      this.output(`[Agent] ${message}`, type);
    }
  }
  /**
   * 运行 Agent
   */
  async run() {
    if (!this.initialized) {
      await this.init();
    }
    this.log("info", "Agent \u5F00\u59CB\u8FD0\u884C");
    this.emit("running");
  }
  /**
   * 停止 Agent
   */
  async stop() {
    this.log("info", "Agent \u505C\u6B62\u8FD0\u884C");
    this.emit("stopped");
  }
};

// src/agent/BaseComponent.ts
var BaseComponent = class {
  constructor(name) {
    this._name = name;
  }
  /**
   * 获取组件名称
   */
  get name() {
    return this._name;
  }
  /**
   * 初始化组件
   * 子类应重写此方法实现具体的初始化逻辑
   */
  async init() {
  }
  /**
   * 销毁组件
   * 子类应重写此方法实现具体的销毁逻辑
   */
  async destroy() {
  }
};

// src/agent/LoggerComponent.ts
import chalk4 from "chalk";
var LoggerComponent = class extends BaseComponent {
  constructor(logLevel = "info") {
    super("logger");
    this.enabled = false;
    this.logLevel = "info";
    this.logLevel = logLevel;
  }
  /**
   * 初始化日志组件
   */
  async init() {
    this.enabled = true;
    this.log("info", "\u65E5\u5FD7\u7CFB\u7EDF\u5DF2\u521D\u59CB\u5316");
  }
  /**
   * 销毁日志组件
   */
  async destroy() {
    this.log("info", "\u65E5\u5FD7\u7CFB\u7EDF\u6B63\u5728\u5173\u95ED");
    this.enabled = false;
  }
  /**
   * 记录调试信息
   */
  debug(message) {
    if (this.shouldLog("debug")) {
      this.log("debug", message);
    }
  }
  /**
   * 记录一般信息
   */
  info(message) {
    if (this.shouldLog("info")) {
      this.log("info", message);
    }
  }
  /**
   * 记录警告信息
   */
  warn(message) {
    if (this.shouldLog("warn")) {
      this.log("warn", message);
    }
  }
  /**
   * 记录错误信息
   */
  error(message, error) {
    if (this.shouldLog("error")) {
      this.log("error", message);
      if (error && this.logLevel === "debug") {
        console.error(error.stack);
      }
    }
  }
  /**
   * 检查是否应该记录给定级别的日志
   */
  shouldLog(level) {
    if (!this.enabled) return false;
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.logLevel];
  }
  /**
   * 记录日志的内部方法
   */
  log(level, message) {
    if (!this.enabled) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    let coloredMessage;
    switch (level) {
      case "debug":
        coloredMessage = chalk4.gray(`[DEBUG] ${message}`);
        break;
      case "info":
        coloredMessage = chalk4.blue(`[INFO] ${message}`);
        break;
      case "warn":
        coloredMessage = chalk4.yellow(`[WARN] ${message}`);
        break;
      case "error":
        coloredMessage = chalk4.red(`[ERROR] ${message}`);
        break;
      default:
        coloredMessage = message;
    }
    console.log(`${chalk4.gray(timestamp)} ${coloredMessage}`);
  }
};

// src/commands/run.ts
function runCommand(program2) {
  program2.command("run").description("\u8FD0\u884C Agent").option("-d, --debug", "\u542F\u7528\u8C03\u8BD5\u6A21\u5F0F", false).action(async (options) => {
    console.log(chalk5.blue("\u{1F680} \u542F\u52A8 Agent..."));
    try {
      const agent = new Agent({ debug: options.debug });
      const logLevel = options.debug ? "debug" : "info";
      const logger = new LoggerComponent(logLevel);
      agent.registerComponent(logger);
      await agent.init();
      const loggerComponent = agent.getComponent("logger");
      if (loggerComponent) {
        loggerComponent.info("Agent \u5DF2\u51C6\u5907\u5C31\u7EEA");
        loggerComponent.debug("\u8FD9\u662F\u4E00\u6761\u8C03\u8BD5\u4FE1\u606F\uFF0C\u4EC5\u5728\u8C03\u8BD5\u6A21\u5F0F\u4E0B\u53EF\u89C1");
      }
      await agent.run();
      const userInput = await agent.handleInput("\u8BF7\u8F93\u5165\u4E00\u6761\u6D88\u606F:");
      agent.output(`\u60A8\u8F93\u5165\u7684\u6D88\u606F\u662F: ${userInput}`, "success");
      await agent.stop();
      await agent.destroy();
      console.log(chalk5.green("\u2705 Agent \u5DF2\u6210\u529F\u505C\u6B62"));
    } catch (error) {
      console.error(chalk5.red("\u274C Agent \u8FD0\u884C\u51FA\u9519:"), error);
    }
  });
}

// src/llm/BaseLLM.ts
var BaseLLM = class extends BaseComponent {
  constructor(name, defaultModel = "gpt-3.5-turbo") {
    super(name);
    this.defaultModel = defaultModel;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1e3,
      maxDelay: 1e4,
      backoffFactor: 2
    };
  }
  /**
   * 设置重试配置
   */
  setRetryConfig(config) {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
  /**
   * 公共方法：带重试机制的聊天
   */
  async chat(request) {
    if (!request.model) {
      request.model = this.defaultModel;
    }
    return this.withRetry(async () => {
      return await this.sendRequest(request);
    });
  }
  /**
   * 便捷方法：发送单条消息
   */
  async sendMessage(content, role = "user", options) {
    const request = {
      messages: [{ role, content }],
      ...options
    };
    const response = await this.chat(request);
    return response.content;
  }
  /**
   * 便捷方法：多轮对话
   */
  async conversation(messages, options) {
    const request = {
      messages,
      ...options
    };
    const response = await this.chat(request);
    return response.content;
  }
  /**
   * 重试机制实现
   */
  async withRetry(operation) {
    let lastError;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt === this.retryConfig.maxRetries) {
          throw lastError;
        }
        if (!this.shouldRetry(error)) {
          throw lastError;
        }
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    throw lastError;
  }
  /**
   * 判断是否应该重试
   */
  shouldRetry(error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("network") || errorMessage.includes("timeout") || errorMessage.includes("rate limit") || errorMessage.includes("503") || errorMessage.includes("502") || errorMessage.includes("500")) {
      return true;
    }
    if (errorMessage.includes("unauthorized") || errorMessage.includes("invalid") || errorMessage.includes("400") || errorMessage.includes("401") || errorMessage.includes("403")) {
      return false;
    }
    return true;
  }
  /**
   * 计算延迟时间（指数退避）
   */
  calculateDelay(attempt) {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt);
    return Math.min(delay, this.retryConfig.maxDelay);
  }
  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * 验证请求参数
   */
  validateRequest(request) {
    if (!request.messages || request.messages.length === 0) {
      throw new Error("Messages array cannot be empty");
    }
    for (const message of request.messages) {
      if (!message.role || !message.content) {
        throw new Error("Each message must have role and content");
      }
    }
  }
};

// src/llm/QwenLLM.ts
import OpenAI from "openai";
var QwenLLM = class extends BaseLLM {
  constructor(config, defaultModel = "qwen3-235b-a22b") {
    super("qwen-llm", defaultModel);
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
    });
  }
  /**
   * 初始化组件
   */
  async init() {
    if (!this.config.apiKey) {
      throw new Error("Qwen API key is required");
    }
    try {
      await this.testConnection();
    } catch (error) {
      throw new Error(`Failed to initialize Qwen LLM: ${error}`);
    }
  }
  /**
   * 判断是否为 Qwen3 模型
   * 根据官方文档，现在大部分模型都基于 Qwen3
   */
  isQwen3Model(model) {
    const lowerModel = model.toLowerCase();
    if (lowerModel.startsWith("qwen3")) {
      return true;
    }
    if (lowerModel.includes("latest")) {
      return true;
    }
    if (lowerModel.includes("2025-04-28")) {
      return true;
    }
    if (lowerModel === "qwen-turbo" || lowerModel === "qwen-plus") {
      return true;
    }
    return false;
  }
  /**
   * 获取 Qwen3 模型的 enable_thinking 默认值
   * 根据千问官方文档：
   * - Qwen3 商业版模型默认值为 False
   * - Qwen3 开源版模型默认值为 True
   * - 但某些场景下需要显式设置为 false
   */
  getEnableThinkingValue(model) {
    if (model === "qwen3-235b-a22b") {
      return false;
    }
    return false;
  }
  /**
   * 发送请求到阿里云百练
   */
  async sendRequest(request) {
    this.validateRequest(request);
    try {
      const model = request.model || this.defaultModel;
      const requestParams = {
        model,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2048,
        stream: false
      };
      if (this.isQwen3Model(model)) {
        requestParams.enable_thinking = this.getEnableThinkingValue(model);
      }
      const completion = await this.client.chat.completions.create(requestParams);
      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error("Invalid response from Qwen API");
      }
      return {
        content: choice.message.content || "",
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : void 0,
        model: completion.model
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Qwen API error: ${error.message}`);
      }
      throw error;
    }
  }
  /**
   * 测试 API 连接
   */
  async testConnection() {
    try {
      const requestParams = {
        model: this.defaultModel,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10
      };
      if (this.isQwen3Model(this.defaultModel)) {
        requestParams.enable_thinking = this.getEnableThinkingValue(this.defaultModel);
      }
      await this.client.chat.completions.create(requestParams);
    } catch (error) {
      throw new Error(`Connection test failed: ${error}`);
    }
  }
  /**
   * 流式聊天（阿里云百练支持）
   */
  async streamChat(request, onChunk) {
    this.validateRequest(request);
    return this.withRetry(async () => {
      try {
        const model = request.model || this.defaultModel;
        const requestParams = {
          model,
          messages: request.messages.map((msg) => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 2048,
          stream: true
        };
        if (this.isQwen3Model(model)) {
          requestParams.enable_thinking = this.getEnableThinkingValue(model);
        }
        const stream = await this.client.chat.completions.create(requestParams);
        let fullContent = "";
        let usage = void 0;
        let model_response = void 0;
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onChunk(delta.content);
          }
          if (chunk.usage) {
            usage = chunk.usage;
          }
          if (chunk.model) {
            model_response = chunk.model;
          }
        }
        return {
          content: fullContent,
          usage: usage ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens
          } : void 0,
          model: model_response
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Qwen streaming error: ${error.message}`);
        }
        throw error;
      }
    });
  }
  /**
   * 获取可用模型列表
   */
  async getModels() {
    return [
      // 动态更新版本（Latest）
      "qwen-plus-latest",
      // 通义千问-Plus-Latest (Qwen3)
      "qwen-turbo-latest",
      // 通义千问-Turbo-Latest (Qwen3)
      // 快照版本（Snapshot） - Qwen3 系列
      "qwen3-235b-a22b",
      // 通义千问3-235B-A22B (默认)
      "qwen3-30b-a3b",
      // 通义千问3-30B-A3B
      "qwen3-32b",
      // 通义千问3-32B
      "qwen3-14b",
      // 通义千问3-14B
      "qwen3-8b",
      // 通义千问3-8B
      "qwen3-4b",
      // 通义千问3-4B
      "qwen3-1.7b",
      // 通义千问3-1.7B
      "qwen3-0.6b",
      // 通义千问3-0.6B
      // 时间快照版本
      "qwen-turbo-2025-04-28",
      // 通义千问-Turbo-2025-04-28 (Qwen3)
      "qwen-plus-2025-04-28",
      // 通义千问-Plus-2025-04-28 (Qwen3)
      // 兼容性别名（指向 Latest 版本）
      "qwen-turbo",
      // 指向 qwen-turbo-latest
      "qwen-plus"
      // 指向 qwen-plus-latest
    ];
  }
  /**
   * 设置系统提示词
   */
  async chatWithSystem(systemPrompt, userMessage, options) {
    const request = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      ...options
    };
    const response = await this.chat(request);
    return response.content;
  }
  /**
   * 函数调用（Qwen 支持函数调用）
   */
  async functionCall(messages, functions, options) {
    try {
      const completion = await this.client.chat.completions.create({
        model: options?.model || this.defaultModel,
        messages,
        functions,
        function_call: "auto",
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 2048
      });
      return completion;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Qwen function call error: ${error.message}`);
      }
      throw error;
    }
  }
  /**
   * 带 thinking 模式控制的聊天（仅适用于 Qwen3 模型）
   */
  async chatWithThinking(request, enableThinking) {
    this.validateRequest(request);
    const model = request.model || this.defaultModel;
    if (!this.isQwen3Model(model)) {
      return this.chat(request);
    }
    return this.withRetry(async () => {
      try {
        const requestParams = {
          model,
          messages: request.messages.map((msg) => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 2048,
          stream: false
        };
        if (enableThinking !== void 0) {
          requestParams.enable_thinking = enableThinking;
        } else {
          requestParams.enable_thinking = this.getEnableThinkingValue(model);
        }
        const completion = await this.client.chat.completions.create(requestParams);
        const choice = completion.choices[0];
        if (!choice || !choice.message) {
          throw new Error("Invalid response from Qwen API");
        }
        return {
          content: choice.message.content || "",
          usage: completion.usage ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens
          } : void 0,
          model: completion.model
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Qwen API error: ${error.message}`);
        }
        throw error;
      }
    });
  }
};

// src/llm/VolcEngineLLM.ts
import OpenAI2 from "openai";
var VolcEngineLLM = class extends BaseLLM {
  constructor(config, defaultModel = "ep-20250417144747-rgffm") {
    super("volcengine-llm", defaultModel);
    this.config = config;
    this.client = new OpenAI2({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://ark.cn-beijing.volces.com/api/v3"
    });
  }
  /**
   * 初始化组件
   */
  async init() {
    if (!this.config.apiKey) {
      throw new Error("VolcEngine API key is required");
    }
    try {
      await this.testConnection();
    } catch (error) {
      throw new Error(`Failed to initialize VolcEngine LLM: ${error}`);
    }
  }
  /**
   * 发送请求到火山方舟
   */
  async sendRequest(request) {
    this.validateRequest(request);
    try {
      const completion = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2048,
        stream: false
      });
      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error("Invalid response from VolcEngine API");
      }
      return {
        content: choice.message.content || "",
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : void 0,
        model: completion.model
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`VolcEngine API error: ${error.message}`);
      }
      throw error;
    }
  }
  /**
   * 测试 API 连接
   */
  async testConnection() {
    try {
      await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10
      });
    } catch (error) {
      throw new Error(`Connection test failed: ${error}`);
    }
  }
  /**
   * 流式聊天（火山方舟支持）
   */
  async streamChat(request, onChunk) {
    this.validateRequest(request);
    return this.withRetry(async () => {
      try {
        const stream = await this.client.chat.completions.create({
          model: request.model || this.defaultModel,
          messages: request.messages.map((msg) => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 2048,
          stream: true
        });
        let fullContent = "";
        let usage = void 0;
        let model = void 0;
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            onChunk(delta.content);
          }
          if (chunk.usage) {
            usage = chunk.usage;
          }
          if (chunk.model) {
            model = chunk.model;
          }
        }
        return {
          content: fullContent,
          usage: usage ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens
          } : void 0,
          model
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`VolcEngine streaming error: ${error.message}`);
        }
        throw error;
      }
    });
  }
  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const models = await this.client.models.list();
      return models.data.map((model) => model.id);
    } catch (error) {
      throw new Error(`Failed to get models: ${error}`);
    }
  }
};

// src/config/defaults.ts
var DEFAULT_CONFIG = {
  llm: {
    qwen: {
      apiKey: process.env.QWEN_API_KEY || "sk-c23da72a37234d68af0b48fc6d685e8b",
      defaultModel: process.env.QWEN_DEFAULT_MODEL || "qwen3-235b-a22b",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    },
    volcengine: {
      apiKey: process.env.VOLCENGINE_API_KEY || "1ddfaee1-1350-46b0-ab87-2db988d24d4b",
      defaultModel: process.env.VOLCENGINE_DEFAULT_MODEL || "ep-20250417144747-rgffm",
      baseURL: "https://ark.cn-beijing.volces.com/api/v3"
    }
  }
};
function getProviderConfig(provider) {
  const config = DEFAULT_CONFIG.llm[provider];
  if (!config) {
    throw new Error(`\u4E0D\u652F\u6301\u7684 LLM \u63D0\u4F9B\u5546: ${provider}`);
  }
  return config;
}
function getSupportedProviders() {
  return Object.keys(DEFAULT_CONFIG.llm);
}
function isProviderSupported(provider) {
  return getSupportedProviders().includes(provider);
}
function loadConfigFromEnv() {
  return {
    llm: {
      qwen: {
        apiKey: process.env.QWEN_API_KEY || DEFAULT_CONFIG.llm.qwen.apiKey,
        defaultModel: process.env.QWEN_DEFAULT_MODEL || DEFAULT_CONFIG.llm.qwen.defaultModel,
        baseURL: process.env.QWEN_BASE_URL || DEFAULT_CONFIG.llm.qwen.baseURL
      },
      volcengine: {
        apiKey: process.env.VOLCENGINE_API_KEY || DEFAULT_CONFIG.llm.volcengine.apiKey,
        defaultModel: process.env.VOLCENGINE_DEFAULT_MODEL || DEFAULT_CONFIG.llm.volcengine.defaultModel,
        baseURL: process.env.VOLCENGINE_BASE_URL || DEFAULT_CONFIG.llm.volcengine.baseURL
      }
    }
  };
}

// src/index.ts
var program = new Command();
program.name("agent").description("\u4E00\u4E2A\u529F\u80FD\u5F3A\u5927\u7684 CLI \u5DE5\u5177").version("1.0.0");
initCommand(program);
runCommand(program);
llmCommand(program);
program.on("--help", () => {
  console.log("");
  console.log(chalk6.green("\u793A\u4F8B:"));
  console.log("  $ agent init myproject");
  console.log("  $ agent run --debug");
  console.log("  $ agent llm --provider qwen");
  console.log("  $ agent llm:models --provider volcengine");
});
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
export {
  Agent,
  BaseComponent,
  BaseLLM,
  DEFAULT_CONFIG,
  LoggerComponent,
  QwenLLM,
  VolcEngineLLM,
  getProviderConfig,
  getSupportedProviders,
  isProviderSupported,
  loadConfigFromEnv
};
