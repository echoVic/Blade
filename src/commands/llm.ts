import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import {
  getModelDescription,
  getModelsWithDescriptions,
  getProviderConfig,
  isProviderSupported,
} from '../config/defaults.js';
import { getCurrentModel, getCurrentProvider } from '../config/user-config.js';
import { QwenChatModel } from '../langchain/models/QwenChatModel.js';
import { VolcEngineChatModel } from '../langchain/models/VolcEngineChatModel.js';

/**
 * 注册 LLM 相关命令
 */
export function llmCommand(program: Command) {
  // LLM 直接聊天命令
  program
    .command('llm')
    .alias('l')
    .description('💬 LLM 直接聊天模式')
    .option('-p, --provider <provider>', '选择 LLM 提供商 (volcengine|qwen)')
    .option('-k, --api-key <key>', 'API 密钥')
    .option('-m, --model <model>', '指定模型')
    .option('-s, --stream', '启用流式输出', false)
    .action(async options => {
      try {
        // 使用用户配置作为默认值
        const provider = options.provider || getCurrentProvider();

        if (!isProviderSupported(provider)) {
          console.log(chalk.red(`❌ 不支持的提供商: ${provider}`));
          console.log(chalk.gray('支持的提供商: qwen, volcengine'));
          return;
        }

        // 验证API密钥
        let apiKey: string;
        try {
          const { validateApiKey } = await import('../config/defaults.js');
          apiKey = validateApiKey(provider, options.apiKey);
        } catch (error) {
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

        const providerConfig = getProviderConfig(provider);
        const model = options.model || getCurrentModel(provider) || providerConfig.defaultModel;
        const modelDescription = getModelDescription(provider, model);

        console.log(chalk.blue(`\n🤖 启动 ${provider.toUpperCase()} LLM 聊天`));
        console.log(chalk.green(`📱 模型: ${modelDescription}`));
        console.log(chalk.gray('💡 输入 "quit" 或 "exit" 退出聊天\n'));

        // 创建LangChain模型实例
        let llm: BaseLanguageModel;
        if (provider === 'qwen') {
          llm = new QwenChatModel({
            apiKey,
            model,
            baseURL: providerConfig.baseURL,
            temperature: 0.7,
            maxTokens: 2000,
          });
        } else {
          llm = new VolcEngineChatModel({
            apiKey,
            model,
            endpoint: providerConfig.baseURL,
            temperature: 0.7,
            maxTokens: 2000,
          });
        }

        console.log(chalk.green(`✅ 已连接 ${provider} (${modelDescription})`));

        // 开始聊天循环
        await startChatLoop(llm, options.stream);
      } catch (error) {
        console.error(chalk.red('❌ LLM 聊天失败:'), error);
      }
    });

  // 模型列表命令
  program
    .command('models')
    .alias('m')
    .description('📋 查看可用模型列表')
    .option('-p, --provider <provider>', '选择 LLM 提供商 (volcengine|qwen)')
    .action(async options => {
      try {
        // 使用用户配置作为默认值
        const provider = options.provider || getCurrentProvider();

        if (!isProviderSupported(provider)) {
          console.log(chalk.red(`❌ 不支持的提供商: ${provider}`));
          return;
        }

        const providerConfig = getProviderConfig(provider);
        const modelsWithDescriptions = getModelsWithDescriptions(provider);

        console.log(chalk.blue(`\n🤖 ${provider.toUpperCase()} 可用模型:`));
        console.log(
          chalk.green(`默认模型: ${getModelDescription(provider, providerConfig.defaultModel)}`)
        );

        // 显示用户配置的当前模型
        const currentUserModel = getCurrentModel(provider);
        if (currentUserModel && currentUserModel !== providerConfig.defaultModel) {
          console.log(chalk.cyan(`用户设置: ${getModelDescription(provider, currentUserModel)}`));
        }

        console.log(chalk.gray('\n支持的模型:'));

        modelsWithDescriptions.forEach((model, index) => {
          const isDefault = model.id === providerConfig.defaultModel;
          const isUserCurrent = model.id === currentUserModel;

          let prefix = '  ';
          if (isDefault) prefix = chalk.yellow('* ');
          if (isUserCurrent) prefix = chalk.cyan('► ');

          console.log(`${prefix}${index + 1}. ${model.id}`);
          console.log(`${prefix}   ${chalk.gray(model.description)}`);
        });

        console.log(chalk.gray('\n* 表示默认模型'));
        if (currentUserModel) {
          console.log(chalk.gray('► 表示用户当前设置'));
        }
      } catch (error) {
        console.error(chalk.red('❌ 获取模型列表失败:'), error);
      }
    });
}

/**
 * 开始聊天循环
 */
async function startChatLoop(llm: BaseLanguageModel, useStream: boolean = false) {
  console.log(chalk.cyan('\n🤖 LLM 聊天开始！输入 "quit" 或 "exit" 退出'));
  console.log(chalk.gray('💡 直接在终端输入消息即可\n'));

  const conversationHistory: any[] = [];

  while (true) {
    try {
      // 获取用户输入
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: '你:',
        },
      ]);

      const userMessage = answers.message.trim();

      if (!userMessage) {
        console.log(chalk.yellow('请输入有效的消息'));
        continue;
      }

      if (userMessage.toLowerCase() === 'quit' || userMessage.toLowerCase() === 'exit') {
        console.log(chalk.blue('👋 再见！'));
        break;
      }

      // 添加用户消息到历史
      conversationHistory.push(new HumanMessage(userMessage));

      // 生成回复
      console.log(chalk.green('\nAI: '));

      if (useStream) {
        // 流式输出
        try {
          const stream = await llm.stream(conversationHistory);
          let fullResponse = '';

          for await (const chunk of stream) {
            const content = chunk.content.toString();
            process.stdout.write(content);
            fullResponse += content;
          }

          console.log('\n');
          conversationHistory.push(new AIMessage(fullResponse));
        } catch (streamError) {
          // 如果流式输出失败，回退到普通输出
          console.log(chalk.yellow('流式输出不可用，使用普通模式'));
          const response = await llm.invoke(conversationHistory);
          const content = response.content.toString();
          console.log(content);
          conversationHistory.push(new AIMessage(content));
        }
      } else {
        // 普通输出
        const response = await llm.invoke(conversationHistory);
        const content = response.content.toString();
        console.log(content);
        conversationHistory.push(new AIMessage(content));
      }

      console.log('\n');
    } catch (error) {
      console.error(chalk.red('❌ 对话失败:'), error);
      console.log(chalk.yellow('请重试或输入 "quit" 退出\n'));
    }
  }
}
