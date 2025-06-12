/**
 * 配置管理命令
 */

import { Command } from 'commander';
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
import { UIDisplay, UIInput, UIProgress } from '../ui/index.js';

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
          UIDisplay.error(`不支持的提供商: ${provider}`);
          UIDisplay.muted('支持的提供商: qwen, volcengine');
          return;
        }
        setCurrentProvider(provider);
      } else {
        // 交互式选择
        const selectedProvider = await UIInput.select(
          '请选择 LLM 提供商:',
          [
            { name: '🤖 千问 (Qwen)', value: 'qwen' },
            { name: '🔥 火山引擎 (VolcEngine)', value: 'volcengine' },
          ],
          { default: getCurrentProvider() }
        );
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
      const provider = options.provider || getCurrentProvider();

      if (!isProviderSupported(provider)) {
        UIDisplay.error(`不支持的提供商: ${provider}`);
        return;
      }

      if (model) {
        // 验证模型是否存在
        const providerConfig = getProviderConfig(provider);
        if (!providerConfig.supportedModels.includes(model)) {
          UIDisplay.error(`模型 ${model} 不支持提供商 ${provider}`);
          UIDisplay.warning('请使用 blade models 查看支持的模型');
          return;
        }
        setCurrentModel(provider, model);
      } else {
        // 交互式选择
        const modelsWithDescriptions = getModelsWithDescriptions(provider);
        const choices = modelsWithDescriptions.map(model => ({
          name: `${model.id} - ${model.description}`,
          value: model.id,
          short: model.id,
        }));

        const selectedModel = await UIInput.select(`请选择 ${provider} 的模型:`, choices, {
          pageSize: 10,
        });
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

      const confirm = await UIInput.confirm(`切换到 ${otherProvider}？(当前: ${currentProvider})`, {
        default: true,
      });

      if (confirm) {
        setCurrentProvider(otherProvider);
      } else {
        UIDisplay.muted('取消切换');
      }
    });

  // 重置配置
  configCmd
    .command('reset')
    .description('🔄 重置配置为默认值')
    .action(async () => {
      const confirm = await UIInput.confirm('确定要重置所有配置吗？', { default: false });

      if (confirm) {
        resetUserConfig();
      } else {
        UIDisplay.muted('取消重置');
      }
    });

  // 配置向导
  configCmd
    .command('wizard')
    .alias('w')
    .description('🧙‍♂️ 配置向导')
    .action(async () => {
      UIDisplay.newline();
      UIDisplay.header('🧙‍♂️ 欢迎使用 Blade 配置向导！');
      UIDisplay.newline();

      // 选择 provider
      const selectedProvider = await UIInput.select(
        '1️⃣ 选择您首选的 LLM 提供商:',
        [
          {
            name: '🤖 千问 (Qwen) - 中文理解优秀，逻辑推理强',
            value: 'qwen',
          },
          {
            name: '🔥 火山引擎 (VolcEngine) - 响应速度快，成本效率高',
            value: 'volcengine',
          },
        ],
        { default: getCurrentProvider() }
      );

      // 选择模型
      const modelsWithDescriptions = getModelsWithDescriptions(selectedProvider);
      const choices = [
        { name: '使用默认模型', value: null },
        ...modelsWithDescriptions.map(model => ({
          name: `${model.id} - ${model.description}`,
          value: model.id,
          short: model.id,
        })),
      ];

      const selectedModel = await UIInput.select('2️⃣ 选择模型:', choices, { pageSize: 10 });

      // 显示保存进度
      const spinner = UIProgress.spinner('保存配置中...');
      spinner.start();

      // 保存配置
      if (selectedModel) {
        setCurrentModel(selectedProvider, selectedModel);
      } else {
        setCurrentProvider(selectedProvider);
      }

      // 模拟保存过程
      await new Promise(resolve => setTimeout(resolve, 500));
      spinner.succeed('配置已保存！');

      UIDisplay.newline();
      UIDisplay.success('🎉 配置完成！');
      UIDisplay.muted('您现在可以直接使用 blade chat、blade llm 等命令，无需指定 -p 参数');
    });
}
