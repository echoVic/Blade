import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { getModelDescription, getProviderConfig, isProviderSupported } from '../config/defaults.js';
import { getCurrentModel, getCurrentProvider } from '../config/user-config.js';
import { AgentFactory } from '../langchain/agents/AgentFactory.js';
import { BladeAgent } from '../langchain/agents/BladeAgent.js';
import { LangChainMemoryManager } from '../langchain/memory/LangChainMemoryManager.js';
import { MemoryType } from '../langchain/memory/types.js';
import { BladeToolkit } from '../langchain/tools/BladeToolkit.js';

/**
 * 注册智能聊天命令 - LangChain 深度集成版本
 *
 * 特性：
 * - ✅ LangChain 原生流式输出
 * - ✅ LangChain Memory 完整集成
 * - ✅ AgentExecutor 原生调用
 * - ✅ 事件驱动架构
 * - ✅ 会话管理
 */
export function chatCommand(program: Command) {
  program
    .command('chat')
    .description('🤖 智能 Agent 聊天')
    .argument('[question...]', '要问的问题（可选）')
    .option('-p, --provider <provider>', '选择 LLM 提供商 (volcengine|qwen)')
    .option('-k, --api-key <key>', 'API 密钥')
    .option('-m, --model <model>', '指定模型')
    .option('-s, --scenario <scenario>', '选择场景 (customer|code|assistant)', 'assistant')
    .option('-i, --interactive', '启动交互式聊天模式', false)
    .option('--stream', '启用 流式输出', false)
    .option('--demo', '运行场景演示', false)
    .option('--memory', '启用 Memory 系统', false)
    .option('--memory-type <type>', 'Memory 类型 (buffer|window)', 'buffer')
    .option('--session-id <id>', '会话 ID (用于 Memory)', undefined)
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

        console.log(chalk.blue('🤖 启动 Agent...'));

        // 生成会话 ID
        const sessionId =
          options.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // 显示启用的功能
        if (options.memory) {
          console.log(chalk.cyan(`🧠 Memory 系统已启用 (${options.memoryType})`));
          console.log(chalk.gray(`   会话 ID: ${sessionId}`));
        }
        // 默认启用流式输出（所有模式）
        options.stream = true; // 默认启用流式输出
        console.log(chalk.cyan('📡 原生流式输出已启用'));
        if (options.debug) {
          console.log(chalk.yellow('🐛 调试模式已启用'));
        }

        // 创建工具包
        const toolkit = new BladeToolkit();
        // 工具在构造时已自动加载

        // 创建 LangChain Memory 管理器
        let memoryManager: LangChainMemoryManager | undefined;
        if (options.memory) {
          memoryManager = new LangChainMemoryManager({
            type: options.memoryType,
            options: { k: options.memoryType === 'window' ? 10 : undefined },
          });

          // 创建会话
          await memoryManager.createSession(sessionId, 'user');
          console.log(chalk.green('✅ Memory 系统已配置并创建会话'));
        }

        // 创建 Agent（集成 Memory）
        let agent: BladeAgent;

        try {
          const agentConfig = {
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
          };

          // 🎯 使用智能 Agent 创建策略
          console.log(chalk.blue('🎯 智能 Agent 创建中...'));

          if (provider === 'qwen') {
            console.log(chalk.gray('  - 使用通义千问简化模式'));
            agent = AgentFactory.createQwenAgent(getScenarioPreset(options.scenario), agentConfig);
          } else {
            console.log(chalk.gray('  - 使用豆包 ReAct Agent 模式'));
            agent = AgentFactory.createVolcEngineAgent(
              getScenarioPreset(options.scenario),
              agentConfig
            );
          }

          console.log(chalk.green('✅ 智能 Agent 创建完成'));

          // 如果启用了 Memory，将其连接到 Agent
          if (memoryManager) {
            // 通过事件监听连接 Memory 和 Agent
            agent.on('execution-start', async event => {
              await memoryManager!.remember(sessionId, MemoryType.CONVERSATION, {
                action: 'agent_start',
                input: event.data.input,
                timestamp: new Date().toISOString(),
              });
            });

            agent.on('execution-end', async event => {
              await memoryManager!.remember(sessionId, MemoryType.CONVERSATION, {
                action: 'agent_end',
                output: event.data.result?.content,
                timestamp: new Date().toISOString(),
              });
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

        // 判断聊天模式
        const question = questionArgs.join(' ');

        if (options.demo) {
          // 演示模式
          await runScenarioDemo(agent, options.scenario, options.stream, sessionId, memoryManager);
        } else if (question) {
          // 单次问答模式
          await answerSingleQuestion(
            agent,
            question,
            options.scenario,
            options.stream, // 使用前面已经设置好的流式输出标志
            sessionId,
            memoryManager
          );
        } else if (options.interactive) {
          // 交互式聊天模式（默认启用流式输出）
          await startInteractiveChat(
            agent,
            options.scenario,
            options.stream || true, // 交互式模式默认启用流式输出
            sessionId,
            memoryManager
          );
        } else {
          // 默认：启动交互式聊天（默认启用流式输出）
          await startInteractiveChat(
            agent,
            options.scenario,
            options.stream || true, // 交互式模式默认启用流式输出
            sessionId,
            memoryManager
          );
        }

        // 清理资源
        if (memoryManager) {
          console.log(chalk.gray('\n🧹 清理 Memory 资源...'));
          await memoryManager.dispose();
        }
      } catch (error) {
        console.error(chalk.red('❌ 启动失败:'), error);
      }
    });
}

/**
 * 单次问答 - LangChain 原生实现
 */
async function answerSingleQuestion(
  agent: BladeAgent,
  question: string,
  scenario: string,
  useStream: boolean = false,
  sessionId: string,
  memoryManager?: LangChainMemoryManager
): Promise<void> {
  console.log(chalk.cyan(`\n💬 AI (${getScenarioName(scenario)}):`) + ' 思考中...\n');

  try {
    // 记录用户输入到 Memory
    if (memoryManager) {
      await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
        role: 'user',
        content: question,
        timestamp: new Date().toISOString(),
      });
    }

    if (useStream) {
      // ✅ 使用 原生流式输出
      console.log(chalk.cyan('📡 原生流式输出:'));

      let fullResponse = '';
      let stepCount = 0;
      const startTime = Date.now();

      // 检查是否是 QwenReActAgent (通过检查特有属性)
      const isQwenReActAgent =
        (agent as any).constructor.name === 'QwenReActAgent' ||
        (typeof (agent as any).parser !== 'undefined' &&
          typeof (agent as any).currentIteration !== 'undefined');

      if (isQwenReActAgent) {
        // 使用 QwenReActAgent 的流式输出
        console.log(chalk.blue('🧠 通义千问 ReAct 推理过程:'));

        for await (const chunk of (agent as any).stream(question)) {
          if (chunk.type === 'thinking') {
            process.stdout.write(chalk.gray(`💭 ${chunk.content}\n`));
          } else if (chunk.type === 'action') {
            stepCount++;
            process.stdout.write(chalk.yellow(`🔄 [步骤${stepCount}] ${chunk.content}\n`));
          } else if (chunk.type === 'observation') {
            process.stdout.write(chalk.cyan(`👁️ ${chunk.content}\n`));
          } else if (chunk.type === 'final') {
            process.stdout.write(chalk.green(`✅ 最终答案: ${chunk.content}\n`));
            fullResponse = chunk.content;
          }
        }
      } else {
        // 使用标准 BladeAgent 的流式输出
        for await (const chunk of agent.stream(question)) {
          if (chunk.type === 'action') {
            // 显示 Agent 执行的动作
            stepCount++;
            process.stdout.write(chalk.gray(`🔄 [步骤${stepCount}] `));
          } else if (chunk.type === 'final') {
            // 显示最终结果
            process.stdout.write(chunk.content);
            fullResponse = chunk.content;
          } else if (chunk.type === 'error') {
            console.error(chalk.red('\n❌ 流式处理错误:'), chunk.content);
            return;
          }
        }
      }

      const endTime = Date.now();
      console.log(
        chalk.gray(`\n📊 流式执行完成: ${stepCount} 个步骤, 耗时 ${endTime - startTime}ms`)
      );

      // 记录 AI 响应到 Memory
      if (memoryManager && fullResponse) {
        await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // 常规输出
      const response = await agent.invoke(question);
      console.log(chalk.white(response.content));

      // 记录 AI 响应到 Memory
      if (memoryManager) {
        await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
        });
      }

      if (response.metadata?.totalSteps && response.metadata.totalSteps > 0) {
        console.log(
          chalk.gray(
            `\n📊 执行统计: ${response.metadata.totalSteps} 个步骤, 耗时 ${response.metadata.totalTime}ms`
          )
        );
      }
    }

    // 显示 Memory 统计
    if (memoryManager) {
      const stats = await memoryManager.getStats(sessionId);
      console.log(chalk.gray(`💾 会话记忆: ${stats.totalEntries} 条记录`));
    }
  } catch (error) {
    console.error(chalk.red('\n❌ 处理失败:'), error);
  }
}

/**
 * 交互式聊天 - LangChain 深度集成
 */
async function startInteractiveChat(
  agent: BladeAgent,
  scenario: string,
  useStream: boolean = false,
  sessionId: string,
  memoryManager?: LangChainMemoryManager
): Promise<void> {
  console.log(chalk.green('\n🎯 进入交互式聊天模式'));
  console.log(chalk.gray('输入 "exit", "quit", "再见" 或按 Ctrl+C 退出'));
  console.log(chalk.gray(`会话 ID: ${sessionId}\n`));

  const scenarioName = getScenarioName(scenario);

  // 如果有 Memory，显示历史对话摘要
  if (memoryManager) {
    try {
      const summary = await memoryManager.summarize(sessionId, 5);
      if (summary && summary.trim()) {
        console.log(chalk.blue('📝 会话历史摘要:'));
        console.log(chalk.gray(summary));
        console.log();
      }
    } catch (error) {
      // 忽略摘要错误
    }
  }

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

      // 检查特殊命令
      if (trimmedMessage === '/memory' && memoryManager) {
        await showMemoryInfo(sessionId, memoryManager);
        continue;
      }

      if (trimmedMessage === '/clear' && memoryManager) {
        await memoryManager.deleteSession(sessionId);
        await memoryManager.createSession(sessionId, 'user');
        console.log(chalk.yellow('🧹 已清空会话记忆'));
        continue;
      }

      console.log(chalk.cyan(`\n🤖 AI (${scenarioName}):`) + ' 思考中...\n');

      // 记录用户输入到 Memory
      if (memoryManager) {
        await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        });
      }

      if (useStream) {
        // ✅ LangChain 原生流式输出
        let fullResponse = '';
        let stepCount = 0;

        // 检查是否是 QwenReActAgent (通过检查特有属性)
        const isQwenReActAgent =
          (agent as any).constructor.name === 'QwenReActAgent' ||
          (typeof (agent as any).parser !== 'undefined' &&
            typeof (agent as any).currentIteration !== 'undefined');

        if (isQwenReActAgent) {
          // 使用 QwenReActAgent 的流式输出
          for await (const chunk of (agent as any).stream(message)) {
            if (chunk.type === 'thinking') {
              process.stdout.write(chalk.gray(`💭 ${chunk.content}\n`));
            } else if (chunk.type === 'action') {
              stepCount++;
              process.stdout.write(chalk.yellow(`🔄 [步骤${stepCount}] ${chunk.content}\n`));
            } else if (chunk.type === 'observation') {
              process.stdout.write(chalk.cyan(`👁️ ${chunk.content}\n`));
            } else if (chunk.type === 'final') {
              process.stdout.write(chalk.green(`✅ 最终答案: ${chunk.content}\n`));
              fullResponse = chunk.content;
            }
          }
        } else {
          // 使用标准 BladeAgent 的流式输出
          for await (const chunk of agent.stream(message)) {
            if (chunk.type === 'action') {
              process.stdout.write(chalk.gray(`🔄 [步骤${++stepCount}] `));
            } else if (chunk.type === 'final') {
              process.stdout.write(chunk.content);
              fullResponse = chunk.content;
            } else if (chunk.type === 'error') {
              console.error(chalk.red('\n❌ 流式处理错误:'), chunk.content);
              break;
            }
          }
        }
        console.log('');

        // 记录 AI 响应到 Memory
        if (memoryManager && fullResponse) {
          await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // 常规输出
        const response = await agent.invoke(message);
        console.log(chalk.white(response.content));

        // 记录 AI 响应到 Memory
        if (memoryManager) {
          await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
            role: 'assistant',
            content: response.content,
            timestamp: new Date().toISOString(),
          });
        }

        if (response.metadata?.totalSteps && response.metadata.totalSteps > 0) {
          console.log(
            chalk.gray(`📊 ${response.metadata.totalSteps} 步骤, ${response.metadata.totalTime}ms`)
          );
        }
      }

      // 显示简化的 Memory 统计
      if (memoryManager) {
        const stats = await memoryManager.getStats(sessionId);
        console.log(chalk.gray(`💾 ${stats.totalEntries} 条记录`));
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
 * 场景演示 - LangChain 原生功能
 */
async function runScenarioDemo(
  agent: BladeAgent,
  scenario: string,
  useStream: boolean = false,
  sessionId: string,
  memoryManager?: LangChainMemoryManager
): Promise<void> {
  console.log(chalk.blue(`\n🎭 ${getScenarioName(scenario)}场景演示\n`));

  const demos = getScenarioDemo(scenario);

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    console.log(chalk.yellow(`\n📋 演示 ${i + 1}/${demos.length}: ${demo.title}`));
    console.log(chalk.gray(`问题: ${demo.question}\n`));

    try {
      // 记录演示问题到 Memory
      if (memoryManager) {
        await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
          role: 'user',
          content: `[演示] ${demo.question}`,
          timestamp: new Date().toISOString(),
        });
      }

      if (useStream) {
        // 使用 LangChain 原生流式输出
        let fullResponse = '';
        for await (const chunk of agent.stream(demo.question)) {
          if (chunk.type === 'final') {
            process.stdout.write(chunk.content);
            fullResponse = chunk.content;
          } else if (chunk.type === 'action') {
            process.stdout.write(chalk.gray('🔄 '));
          }
        }
        console.log('\n');

        // 记录演示响应到 Memory
        if (memoryManager && fullResponse) {
          await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        const response = await agent.invoke(demo.question);
        console.log(chalk.white(response.content));

        // 记录演示响应到 Memory
        if (memoryManager) {
          await memoryManager.remember(sessionId, MemoryType.CONVERSATION, {
            role: 'assistant',
            content: response.content,
            timestamp: new Date().toISOString(),
          });
        }

        if (response.metadata?.totalSteps && response.metadata.totalSteps > 0) {
          console.log(
            chalk.gray(
              `📊 执行统计: ${response.metadata.totalSteps} 个步骤, 耗时 ${response.metadata.totalTime}ms`
            )
          );
        }
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

  // 显示演示期间的 Memory 统计
  if (memoryManager) {
    const stats = await memoryManager.getStats(sessionId);
    console.log(chalk.blue(`\n📊 演示会话统计: ${stats.totalEntries} 条记录`));
  }
}

/**
 * 显示 Memory 信息
 */
async function showMemoryInfo(
  sessionId: string,
  memoryManager: LangChainMemoryManager
): Promise<void> {
  try {
    console.log(chalk.blue('\n📝 Memory 信息:'));

    const stats = await memoryManager.getStats(sessionId);
    console.log(chalk.gray(`会话 ID: ${sessionId}`));
    console.log(chalk.gray(`记录总数: ${stats.totalEntries}`));
    console.log(chalk.gray(`最近活动: ${new Date().toISOString()}`));

    // 显示最近的对话
    const recent = await memoryManager.recall(sessionId, undefined, MemoryType.CONVERSATION);
    if (recent.length > 0) {
      console.log(chalk.blue('\n💬 最近对话:'));
      recent.slice(-6).forEach(entry => {
        const content = entry.content as any;
        if (content?.role && content?.content) {
          const icon = content.role === 'user' ? '👤' : '🤖';
          const text =
            content.content.length > 50
              ? content.content.substring(0, 50) + '...'
              : content.content;
          console.log(chalk.gray(`${icon} ${text}`));
        }
      });
    }

    console.log(chalk.gray('\n💡 提示: 输入 "/clear" 清空记忆, 输入 "/memory" 查看记忆信息'));
  } catch (error) {
    console.error(chalk.red('❌ 获取 Memory 信息失败:'), error);
  }
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
