import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { getModelDescription, getProviderConfig, isProviderSupported } from '../config/defaults.js';
import { getCurrentModel, getCurrentProvider } from '../config/user-config.js';
import { AgentFactory } from '../langchain/agents/AgentFactory.js';
import { BladeAgent } from '../langchain/agents/BladeAgent.js';
import { BladeChains } from '../langchain/chains/BladeChains.js';
import { LangChainMemoryManager } from '../langchain/memory/LangChainMemoryManager.js';
import { BladeToolkit } from '../langchain/tools/BladeToolkit.js';
import { getAllBuiltinTools } from '../langchain/tools/builtin/index.js';

/**
 * 注册智能聊天命令 - LangChain 版本
 */
export function agentLlmCommand(program: Command) {
  program
    .command('chat')
    .description('🤖 智能 Agent 聊天')
    .argument('[question...]', '要问的问题（可选）')
    .option('-p, --provider <provider>', '选择 LLM 提供商 (volcengine|qwen)')
    .option('-k, --api-key <key>', 'API 密钥')
    .option('-m, --model <model>', '指定模型')
    .option('-s, --scenario <scenario>', '选择场景 (customer|code|assistant)', 'assistant')
    .option('-i, --interactive', '启动交互式聊天模式', false)
    .option('--stream', '启用流式输出', false)
    .option('--demo', '运行场景演示', false)
    .option('--memory', '启用记忆功能（LangChain Memory）', false)
    .option('--memory-type <type>', '记忆类型 (buffer|window)', 'buffer')
    .option('--chains', '启用 Chains 功能', false)
    .option('--debug', '启用调试模式', false)
    .action(async (questionArgs, options) => {
      try {
        // 使用用户配置作为默认值
        const provider = options.provider || getCurrentProvider();

        // 验证提供商
        if (!isProviderSupported(provider)) {
          console.log(chalk.red(`❌ 不支持的提供商: ${provider}`));
          console.log(chalk.gray('支持的提供商: qwen, volcengine'));
          return;
        }

        // 获取模型（优先级：命令行 > 用户配置 > 默认）
        const userModel = getCurrentModel(provider);
        const defaultModel = getProviderConfig(provider).defaultModel;
        const model = options.model || userModel || defaultModel;

        console.log(chalk.blue('🤖 启动 LangChain Agent...'));

        // 显示启用的功能
        if (options.memory) {
          console.log(chalk.cyan(`🧠 LangChain Memory 已启用 (${options.memoryType})`));
        }
        if (options.chains) {
          console.log(chalk.cyan('⛓️ Chains 功能已启用'));
        }
        if (options.debug) {
          console.log(chalk.yellow('🐛 调试模式已启用'));
        }

        // 创建工具包
        const toolkit = new BladeToolkit({
          name: 'MainToolkit',
          description: '主工具包',
          enableConfirmation: false,
        });

        // 注册所有内置工具
        const builtinTools = getAllBuiltinTools();
        toolkit.registerTools(builtinTools);

        // 创建 Agent
        let agent: BladeAgent;

        try {
          if (provider === 'qwen') {
            agent = AgentFactory.createQwenAgent(getScenarioPreset(options.scenario), {
              apiKey: options.apiKey,
              modelName: model,
              toolkit,
              overrides: {
                streaming: options.stream,
                debug: options.debug,
                memory: options.memory
                  ? {
                      enabled: true,
                      maxMessages: 50,
                      contextWindow: 4000,
                    }
                  : undefined,
              },
            });
          } else {
            agent = AgentFactory.createVolcEngineAgent(getScenarioPreset(options.scenario), {
              apiKey: options.apiKey,
              modelName: model,
              toolkit,
              overrides: {
                streaming: options.stream,
                debug: options.debug,
                memory: options.memory
                  ? {
                      enabled: true,
                      maxMessages: 50,
                      contextWindow: 4000,
                    }
                  : undefined,
              },
            });
          }
        } catch (error) {
          // 检查是否是API密钥相关错误
          const errorMessage = (error as Error).message;
          if (
            errorMessage.includes('API密钥') ||
            errorMessage.includes('API key') ||
            errorMessage.includes('apiKey')
          ) {
            console.log(chalk.red('\n❌ API密钥配置错误'));
            console.log(chalk.yellow('\n💡 配置API密钥的方法:'));
            console.log(chalk.gray('1. 命令行参数: --api-key your-api-key'));
            console.log(
              chalk.gray(
                '2. 环境变量: export QWEN_API_KEY=your-key 或 export VOLCENGINE_API_KEY=your-key'
              )
            );
            console.log(chalk.gray('3. .env 文件: 复制 config.env.example 为 .env 并填入密钥'));
            console.log(chalk.gray('\n📖 获取API密钥:'));
            if (provider === 'qwen') {
              console.log(chalk.gray('千问: https://dashscope.console.aliyun.com/apiKey'));
            } else if (provider === 'volcengine') {
              console.log(
                chalk.gray(
                  '火山引擎: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey'
                )
              );
            }
            return;
          }
          throw error;
        }

        const modelDescription = getModelDescription(provider, model);
        console.log(chalk.green(`✅ 使用 ${provider} (${modelDescription})`));

        // 设置记忆功能
        if (options.memory) {
          new LangChainMemoryManager({
            type: options.memoryType,
            options: { k: 50 },
          });

          // 这里可以将 memory 集成到 agent，但当前 BladeAgent 还没有直接的 memory 接口
          // 可以通过事件监听或插件系统来集成
          console.log(chalk.green('📝 记忆系统已配置'));
        }

        // 设置 Chains 功能
        let chains: BladeChains | undefined;
        if (options.chains) {
          chains = new BladeChains();

          // 注册工具到 chains
          builtinTools.forEach(tool => {
            chains!.registerTool(tool.name, tool);
          });

          console.log(chalk.green('⛓️ Chains 系统已配置'));
        }

        // 判断聊天模式
        const question = questionArgs.join(' ');

        if (options.demo) {
          // 演示模式
          await runScenarioDemo(agent, options.scenario, options.chains ? chains : undefined);
        } else if (question) {
          // 单次问答模式
          await answerSingleQuestion(
            agent,
            question,
            options.scenario,
            options.stream,
            options.chains ? chains : undefined
          );
        } else if (options.interactive) {
          // 交互式聊天模式
          await startInteractiveChat(
            agent,
            options.scenario,
            options.stream,
            options.chains ? chains : undefined
          );
        } else {
          // 默认：启动交互式聊天
          await startInteractiveChat(
            agent,
            options.scenario,
            options.stream,
            options.chains ? chains : undefined
          );
        }
      } catch (error) {
        console.error(chalk.red('❌ 启动失败:'), error);
      }
    });
}

/**
 * 单次问答
 */
async function answerSingleQuestion(
  agent: BladeAgent,
  question: string,
  scenario: string,
  useStream: boolean = false,
  chains?: BladeChains
): Promise<void> {
  console.log(chalk.cyan(`\n💬 AI (${getScenarioName(scenario)}):`) + ' 思考中...\n');

  try {
    if (
      (chains && question.includes('链式')) ||
      question.includes('步骤') ||
      question.includes('chain')
    ) {
      // 使用 Chains 处理复杂任务
      console.log(chalk.blue('🔗 检测到复杂任务，使用 Chains 处理...'));

      // 这里可以根据问题类型动态创建链
      // 现在先用简单的方式处理
      const response = await agent.invoke(question);
      console.log(chalk.white(response.content));
    } else {
      // 常规 Agent 处理
      if (useStream) {
        // 流式输出
        const response = await agent.invoke(question);

        // 模拟流式输出效果
        const content = response.content;
        for (let i = 0; i < content.length; i++) {
          process.stdout.write(content[i]);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        console.log('\n');
      } else {
        // 常规输出
        const response = await agent.invoke(question);
        console.log(chalk.white(response.content));

        if (response.metadata?.totalSteps && response.metadata.totalSteps > 0) {
          console.log(
            chalk.gray(
              `\n📊 执行统计: ${response.metadata.totalSteps} 个步骤, 耗时 ${response.metadata.totalTime}ms`
            )
          );
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('\n❌ 处理失败:'), error);
  }
}

/**
 * 交互式聊天
 */
async function startInteractiveChat(
  agent: BladeAgent,
  scenario: string,
  useStream: boolean = false,
  chains?: BladeChains
): Promise<void> {
  console.log(chalk.green('\n🎯 进入交互式聊天模式'));
  console.log(chalk.gray('输入 "exit", "quit", "再见" 或按 Ctrl+C 退出\n'));

  const scenarioName = getScenarioName(scenario);

  while (true) {
    try {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: `💬 您 (${scenarioName}):`,
          validate: (input: string) => input.trim().length > 0 || '请输入有效的消息',
        },
      ]);

      // 检查退出条件
      const trimmedMessage = message.trim().toLowerCase();
      if (['exit', 'quit', '再见', 'bye', 'goodbye'].includes(trimmedMessage)) {
        console.log(chalk.green('\n👋 再见！'));
        break;
      }

      console.log(chalk.cyan(`\n🤖 AI (${scenarioName}):`) + ' 思考中...\n');

      if (
        chains &&
        (message.includes('链式') || message.includes('步骤') || message.includes('chain'))
      ) {
        // 使用 Chains 处理
        console.log(chalk.blue('🔗 使用 Chains 处理复杂任务...'));
        const response = await agent.invoke(message);
        console.log(chalk.white(response.content));
      } else {
        // 常规处理
        if (useStream) {
          // 流式输出
          const response = await agent.invoke(message);

          // 模拟流式输出
          const content = response.content;
          for (let i = 0; i < content.length; i++) {
            process.stdout.write(content[i]);
            await new Promise(resolve => setTimeout(resolve, 15));
          }
          console.log('\n');
        } else {
          // 常规输出
          const response = await agent.invoke(message);
          console.log(chalk.white(response.content));

          if (response.metadata?.totalSteps && response.metadata.totalSteps > 0) {
            console.log(
              chalk.gray(
                `📊 执行统计: ${response.metadata.totalSteps} 个步骤, 耗时 ${response.metadata.totalTime}ms`
              )
            );
          }
        }
      }
    } catch (error) {
      if ((error as any).name === 'ExitPromptError') {
        console.log(chalk.green('\n👋 再见！'));
        break;
      }
      console.error(chalk.red('\n❌ 处理失败:'), error);
    }
  }
}

/**
 * 场景演示
 */
async function runScenarioDemo(
  agent: BladeAgent,
  scenario: string,
  _chains?: BladeChains
): Promise<void> {
  console.log(chalk.blue(`\n🎭 ${getScenarioName(scenario)}场景演示\n`));

  const demos = getScenarioDemo(scenario);

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    console.log(chalk.yellow(`\n📋 演示 ${i + 1}/${demos.length}: ${demo.title}`));
    console.log(chalk.gray(`问题: ${demo.question}\n`));

    try {
      const response = await agent.invoke(demo.question);
      console.log(chalk.white(response.content));

      if (response.metadata?.totalSteps && response.metadata.totalSteps > 0) {
        console.log(
          chalk.gray(
            `📊 执行统计: ${response.metadata.totalSteps} 个步骤, 耗时 ${response.metadata.totalTime}ms`
          )
        );
      }
    } catch (error) {
      console.error(chalk.red('❌ 演示失败:'), error);
    }

    if (i < demos.length - 1) {
      console.log(chalk.gray('\n按 Enter 继续下一个演示...'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
    }
  }

  console.log(chalk.green('\n✅ 场景演示完成！'));
}

/**
 * 获取场景预设
 */
function getScenarioPreset(
  scenario: string
): keyof typeof import('../langchain/agents/AgentFactory.js').AgentPresets {
  switch (scenario) {
    case 'customer':
      return 'GENERAL_ASSISTANT';
    case 'code':
      return 'CODE_ASSISTANT';
    case 'assistant':
    default:
      return 'GENERAL_ASSISTANT';
  }
}

/**
 * 获取场景名称
 */
function getScenarioName(scenario: string): string {
  switch (scenario) {
    case 'customer':
      return '客服助手';
    case 'code':
      return '代码助手';
    case 'assistant':
    default:
      return '智能助手';
  }
}

/**
 * 获取场景演示内容
 */
function getScenarioDemo(scenario: string) {
  switch (scenario) {
    case 'customer':
      return [
        {
          title: '产品咨询',
          question: '你们有什么产品？价格如何？',
        },
        {
          title: '服务支持',
          question: '我遇到了问题，需要技术支持',
        },
      ];
    case 'code':
      return [
        {
          title: '代码审查',
          question: '请帮我分析这段代码的问题：function test() { var x = 1; return x + y; }',
        },
        {
          title: '项目管理',
          question: '请帮我查看当前目录的文件结构',
        },
      ];
    case 'assistant':
    default:
      return [
        {
          title: '信息查询',
          question: '请告诉我今天的日期和时间',
        },
        {
          title: '任务处理',
          question: '生成一个随机的UUID',
        },
      ];
  }
}
