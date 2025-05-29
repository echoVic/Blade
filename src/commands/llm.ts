import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import { Agent, QwenLLM, VolcEngineLLM, getProviderConfig, isProviderSupported } from '../index.js';

/**
 * 注册 LLM 测试命令
 */
export function llmCommand(program: Command) {
  program
    .command('llm')
    .description('测试 LLM 功能')
    .option('-p, --provider <provider>', '选择 LLM 提供商 (volcengine|qwen)', 'qwen')
    .option('-k, --api-key <key>', 'API 密钥')
    .option('-m, --model <model>', '指定模型')
    .option('-s, --stream', '启用流式输出', false)
    .action(async (options) => {
      console.log(chalk.blue('🤖 启动 LLM 测试...'));
      
      try {
        // 验证提供商
        if (!isProviderSupported(options.provider)) {
          console.log(chalk.red(`❌ 不支持的提供商: ${options.provider}`));
          console.log(chalk.yellow('支持的提供商: qwen, volcengine'));
          return;
        }

        // 获取默认配置
        const providerConfig = getProviderConfig(options.provider);
        
        // 获取 API 密钥，优先级：命令行参数 > 环境变量 > 默认配置
        let apiKey = options.apiKey || providerConfig.apiKey;
        
        if (!apiKey || apiKey.startsWith('sk-') && apiKey.length < 20) {
          const answers = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: `请输入 ${options.provider} 的 API 密钥:`,
              mask: '*'
            }
          ]);
          apiKey = answers.apiKey;
        }

        if (!apiKey) {
          console.log(chalk.red('❌ API 密钥不能为空'));
          return;
        }

        // 获取模型名称
        const model = options.model || providerConfig.defaultModel;

        // 创建 Agent 实例
        const agent = new Agent({ debug: true });

        // 根据提供商创建相应的 LLM 实例
        let llm: any;
        switch (options.provider) {
          case 'volcengine':
            llm = new VolcEngineLLM({ apiKey }, model);
            break;
          case 'qwen':
            llm = new QwenLLM({ apiKey }, model);
            break;
        }

        // 注册 LLM 组件
        agent.registerComponent(llm);

        // 初始化 Agent
        await agent.init();

        console.log(chalk.green(`✅ ${options.provider} LLM 初始化成功`));
        console.log(chalk.gray(`使用模型: ${model}`));

        // 开始交互式聊天
        console.log(chalk.cyan('开始聊天（输入 "exit" 退出）:'));
        
        while (true) {
          const { message } = await inquirer.prompt([
            {
              type: 'input',
              name: 'message',
              message: '你:'
            }
          ]);

          if (message.toLowerCase() === 'exit') {
            break;
          }

          if (!message.trim()) {
            continue;
          }

          try {
            console.log(chalk.gray('AI 正在思考...'));

            if (options.stream && llm.streamChat) {
              // 流式输出
              process.stdout.write(chalk.green('AI: '));
              await llm.streamChat(
                {
                  messages: [{ role: 'user', content: message }]
                },
                (chunk: string) => {
                  process.stdout.write(chunk);
                }
              );
              console.log(); // 换行
            } else {
              // 普通输出
              const response = await llm.sendMessage(message);
              console.log(chalk.green('AI:'), response);
            }

          } catch (error) {
            console.error(chalk.red('❌ 请求失败:'), error);
          }
        }

        // 清理资源
        await agent.destroy();
        console.log(chalk.green('✅ 聊天结束'));

      } catch (error) {
        console.error(chalk.red('❌ LLM 测试失败:'), error);
      }
    });

  // 添加模型列表子命令
  program
    .command('llm:models')
    .description('获取可用模型列表')
    .option('-p, --provider <provider>', '选择 LLM 提供商 (volcengine|qwen)', 'qwen')
    .option('-k, --api-key <key>', 'API 密钥')
    .action(async (options) => {
      try {
        // 验证提供商
        if (!isProviderSupported(options.provider)) {
          console.log(chalk.red(`❌ 不支持的提供商: ${options.provider}`));
          console.log(chalk.yellow('支持的提供商: qwen, volcengine'));
          return;
        }

        // 获取默认配置
        const providerConfig = getProviderConfig(options.provider);
        
        // 获取 API 密钥
        let apiKey = options.apiKey || providerConfig.apiKey;
        
        if (!apiKey || apiKey.startsWith('sk-') && apiKey.length < 20) {
          const answers = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: `请输入 ${options.provider} 的 API 密钥:`,
              mask: '*'
            }
          ]);
          apiKey = answers.apiKey;
        }

        // 创建 LLM 实例
        let llm: any;
        switch (options.provider) {
          case 'volcengine':
            llm = new VolcEngineLLM({ apiKey });
            break;
          case 'qwen':
            llm = new QwenLLM({ apiKey });
            break;
        }

        console.log(chalk.blue(`🔍 获取 ${options.provider} 可用模型...`));
        
        const models = await llm.getModels();
        const defaultModel = providerConfig.defaultModel;
        
        console.log(chalk.green(`✅ ${options.provider} 可用模型:`));
        models.forEach((model: string, index: number) => {
          const isDefault = model === defaultModel;
          const marker = isDefault ? chalk.yellow(' (默认)') : '';
          console.log(chalk.cyan(`  ${index + 1}. ${model}${marker}`));
        });

      } catch (error) {
        console.error(chalk.red('❌ 获取模型列表失败:'), error);
      }
    });
} 