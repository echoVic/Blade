/**
 * 配置管理命令
 */

import chalk from 'chalk';
import { Command } from 'commander';
import inquirer from 'inquirer';
import {
  getModelsWithDescriptions,
  getProviderConfig,
  isProviderSupported,
} from '../config/defaults.js';
import {
  getCurrentProvider,
  resetUserConfig,
  setCurrentModel,
  setCurrentProvider,
  showCurrentConfig,
} from '../config/user-config.js';

/**
 * 注册配置相关命令
 */
export function configCommand(program: Command) {
  const configCmd = program.command('config').description('⚙️ 配置管理');

  // 显示当前配置
  configCmd
    .command('show')
    .alias('s')
    .description('📋 显示当前配置')
    .action(() => {
      showCurrentConfig();
    });

  // 设置 provider
  configCmd
    .command('set-provider')
    .alias('sp')
    .description('🔧 设置当前 LLM 提供商')
    .argument('[provider]', 'LLM 提供商 (qwen|volcengine)')
    .action(async provider => {
      if (provider) {
        if (!isProviderSupported(provider)) {
          console.log(chalk.red(`❌ 不支持的提供商: ${provider}`));
          console.log(chalk.gray('支持的提供商: qwen, volcengine'));
          return;
        }
        setCurrentProvider(provider);
      } else {
        // 交互式选择
        const { selectedProvider } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedProvider',
            message: '请选择 LLM 提供商:',
            choices: [
              { name: '🤖 千问 (Qwen)', value: 'qwen' },
              { name: '🔥 火山引擎 (VolcEngine)', value: 'volcengine' },
            ],
            default: getCurrentProvider(),
          },
        ]);
        setCurrentProvider(selectedProvider);
      }
    });

  // 设置模型
  configCmd
    .command('set-model')
    .alias('sm')
    .description('🎯 设置当前模型')
    .option('-p, --provider <provider>', '指定提供商')
    .argument('[model]', '模型名称')
    .action(async (model, options) => {
      let provider = options.provider || getCurrentProvider();

      if (!isProviderSupported(provider)) {
        console.log(chalk.red(`❌ 不支持的提供商: ${provider}`));
        return;
      }

      if (model) {
        // 验证模型是否存在
        const providerConfig = getProviderConfig(provider);
        if (!providerConfig.supportedModels.includes(model)) {
          console.log(chalk.red(`❌ 模型 ${model} 不支持提供商 ${provider}`));
          console.log(chalk.yellow('请使用 blade models 查看支持的模型'));
          return;
        }
        setCurrentModel(provider, model);
      } else {
        // 交互式选择
        const modelsWithDescriptions = getModelsWithDescriptions(provider);
        const choices = modelsWithDescriptions.map(model => ({
          name: `${model.id} ${chalk.gray(`- ${model.description}`)}`,
          value: model.id,
          short: model.id,
        }));

        const { selectedModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedModel',
            message: `请选择 ${provider} 的模型:`,
            choices,
            pageSize: 10,
          },
        ]);
        setCurrentModel(provider, selectedModel);
      }
    });

  // 切换 provider（快捷命令）
  configCmd
    .command('switch')
    .alias('sw')
    .description('🔄 快速切换 provider')
    .action(async () => {
      const currentProvider = getCurrentProvider();
      const otherProvider = currentProvider === 'qwen' ? 'volcengine' : 'qwen';

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `切换到 ${otherProvider}？(当前: ${currentProvider})`,
          default: true,
        },
      ]);

      if (confirm) {
        setCurrentProvider(otherProvider);
      } else {
        console.log(chalk.gray('取消切换'));
      }
    });

  // 重置配置
  configCmd
    .command('reset')
    .description('🔄 重置配置为默认值')
    .action(async () => {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '确定要重置所有配置吗？',
          default: false,
        },
      ]);

      if (confirm) {
        resetUserConfig();
      } else {
        console.log(chalk.gray('取消重置'));
      }
    });

  // 配置向导
  configCmd
    .command('wizard')
    .alias('w')
    .description('🧙‍♂️ 配置向导')
    .action(async () => {
      console.log(chalk.blue('\n🧙‍♂️ 欢迎使用 Blade 配置向导！\n'));

      // 选择 provider
      const { selectedProvider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProvider',
          message: '1️⃣ 选择您首选的 LLM 提供商:',
          choices: [
            {
              name: '🤖 千问 (Qwen) - 中文理解优秀，逻辑推理强',
              value: 'qwen',
            },
            {
              name: '🔥 火山引擎 (VolcEngine) - 响应速度快，成本效率高',
              value: 'volcengine',
            },
          ],
          default: getCurrentProvider(),
        },
      ]);

      // 选择模型
      const modelsWithDescriptions = getModelsWithDescriptions(selectedProvider);
      const choices = modelsWithDescriptions.map(model => ({
        name: `${model.id} ${chalk.gray(`- ${model.description}`)}`,
        value: model.id,
        short: model.id,
      }));

      const { selectedModel } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedModel',
          message: '2️⃣ 选择模型:',
          choices: [{ name: chalk.gray('使用默认模型'), value: null }, ...choices],
          pageSize: 10,
        },
      ]);

      // 保存配置
      if (selectedModel) {
        setCurrentModel(selectedProvider, selectedModel);
      } else {
        setCurrentProvider(selectedProvider);
      }

      console.log(chalk.green('\n🎉 配置完成！'));
      console.log(chalk.gray('您现在可以直接使用 blade chat、blade llm 等命令，无需指定 -p 参数'));
    });
}
