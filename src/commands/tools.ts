import chalk from 'chalk';
import { Command } from 'commander';
import {
  createToolManager,
  getBuiltinToolsByCategory,
  type ToolDefinition,
} from '../tools/index.js';

/**
 * 工具相关命令
 */
export function toolsCommand(program: Command): void {
  const toolsCmd = program.command('tools').description('🔧 工具管理和操作');

  // 列出所有工具
  toolsCmd
    .command('list')
    .description('列出所有可用工具')
    .option('-c, --category <category>', '按分类过滤')
    .option('-s, --search <query>', '搜索工具')
    .option('--format <format>', '输出格式', 'table')
    .action(async options => {
      try {
        const toolManager = await createToolManager();
        let tools = toolManager.getTools();

        // 分类过滤
        if (options.category) {
          tools = tools.filter(
            tool => tool.category?.toLowerCase() === options.category.toLowerCase()
          );
        }

        // 搜索过滤
        if (options.search) {
          const query = options.search.toLowerCase();
          tools = tools.filter(
            tool =>
              tool.name.toLowerCase().includes(query) ||
              tool.description.toLowerCase().includes(query) ||
              (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(query)))
          );
        }

        if (tools.length === 0) {
          console.log(chalk.yellow('未找到匹配的工具'));
          return;
        }

        if (options.format === 'json') {
          console.log(JSON.stringify(tools, null, 2));
        } else {
          displayToolsTable(tools);
        }
      } catch (error: any) {
        console.error(chalk.red('工具列表获取失败:'), error.message);
      }
    });

  // 查看工具详情
  toolsCmd
    .command('info <toolName>')
    .description('查看工具详细信息')
    .action(async toolName => {
      try {
        const toolManager = await createToolManager();
        const tool = toolManager.getTool(toolName);

        if (!tool) {
          console.log(chalk.red(`工具 "${toolName}" 不存在`));
          return;
        }

        displayToolInfo(tool);
      } catch (error: any) {
        console.error(chalk.red('工具信息获取失败:'), error.message);
      }
    });

  // 调用工具
  toolsCmd
    .command('call <toolName>')
    .description('调用指定工具')
    .option('-p, --params <params>', '工具参数（JSON格式）', '{}')
    .option('-f, --file <file>', '从文件读取参数')
    .action(async (toolName, options) => {
      try {
        const toolManager = await createToolManager();

        if (!toolManager.hasTool(toolName)) {
          console.log(chalk.red(`工具 "${toolName}" 不存在`));
          return;
        }

        let params: Record<string, any> = {};

        if (options.file) {
          const fs = await import('fs/promises');
          const fileContent = await fs.readFile(options.file, 'utf8');
          params = JSON.parse(fileContent);
        } else {
          params = JSON.parse(options.params);
        }

        console.log(chalk.blue(`调用工具: ${toolName}`));
        console.log(chalk.gray('参数:'), JSON.stringify(params, null, 2));
        console.log('');

        const response = await toolManager.callTool({
          toolName,
          parameters: params,
        });

        displayToolResult(response);
      } catch (error: any) {
        console.error(chalk.red('工具调用失败:'), error.message);
      }
    });

  // 生成工具文档
  toolsCmd
    .command('docs')
    .description('生成工具文档')
    .option('-o, --output <file>', '输出文件路径')
    .option('-f, --format <format>', '文档格式', 'markdown')
    .action(async options => {
      try {
        const toolManager = await createToolManager();
        const tools = toolManager.getTools();
        const categories = getBuiltinToolsByCategory();

        const docs = generateToolDocs(tools, categories);

        if (options.output) {
          const fs = await import('fs/promises');
          await fs.writeFile(options.output, docs, 'utf8');
          console.log(chalk.green(`工具文档已保存到: ${options.output}`));
        } else {
          console.log(docs);
        }
      } catch (error: any) {
        console.error(chalk.red('文档生成失败:'), error.message);
      }
    });

  // 工具统计
  toolsCmd
    .command('stats')
    .description('显示工具统计信息')
    .action(async () => {
      try {
        const toolManager = await createToolManager();
        const stats = toolManager.getStats();
        const categories = getBuiltinToolsByCategory();

        console.log(chalk.blue('📊 工具统计信息'));
        console.log('');

        console.log(chalk.cyan('总体统计:'));
        console.log(`  总工具数: ${chalk.yellow(stats.totalTools)}`);
        console.log(`  启用工具: ${chalk.green(stats.enabledTools)}`);
        console.log(`  禁用工具: ${chalk.red(stats.totalTools - stats.enabledTools)}`);
        console.log(`  正在运行: ${chalk.blue(stats.runningExecutions)}`);
        console.log('');

        console.log(chalk.cyan('执行统计:'));
        console.log(`  总执行次数: ${chalk.yellow(stats.totalExecutions)}`);
        console.log(`  成功执行: ${chalk.green(stats.successfulExecutions)}`);
        console.log(`  失败执行: ${chalk.red(stats.failedExecutions)}`);
        console.log('');

        console.log(chalk.cyan('分类统计:'));
        for (const [category, tools] of Object.entries(categories)) {
          console.log(`  ${category}: ${chalk.yellow(tools.length)} 个工具`);
        }
      } catch (error: any) {
        console.error(chalk.red('统计信息获取失败:'), error.message);
      }
    });

  // 测试工具
  toolsCmd
    .command('test <toolName>')
    .description('测试工具功能')
    .action(async toolName => {
      try {
        const toolManager = await createToolManager();
        const tool = toolManager.getTool(toolName);

        if (!tool) {
          console.log(chalk.red(`工具 "${toolName}" 不存在`));
          return;
        }

        console.log(chalk.blue(`🧪 测试工具: ${toolName}`));
        console.log('');

        // 生成测试参数
        const testParams = generateTestParams(tool);
        console.log(chalk.gray('测试参数:'), JSON.stringify(testParams, null, 2));
        console.log('');

        const response = await toolManager.callTool({
          toolName,
          parameters: testParams,
        });

        displayToolResult(response);
      } catch (error: any) {
        console.error(chalk.red('工具测试失败:'), error.message);
      }
    });
}

/**
 * 显示工具表格
 */
function displayToolsTable(tools: ToolDefinition[]): void {
  console.log(chalk.blue(`📋 找到 ${tools.length} 个工具:`));
  console.log('');

  const categoryGroups = tools.reduce(
    (groups, tool) => {
      const category = tool.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(tool);
      return groups;
    },
    {} as Record<string, ToolDefinition[]>
  );

  for (const [category, categoryTools] of Object.entries(categoryGroups)) {
    console.log(chalk.cyan(`${category.toUpperCase()} (${categoryTools.length}):`));

    for (const tool of categoryTools) {
      const tags = tool.tags ? chalk.gray(`[${tool.tags.join(', ')}]`) : '';
      const version = tool.version ? chalk.dim(`v${tool.version}`) : '';

      console.log(`  ${chalk.yellow(tool.name)} ${version} ${tags}`);
      console.log(`    ${chalk.gray(tool.description)}`);
    }
    console.log('');
  }
}

/**
 * 显示工具详细信息
 */
function displayToolInfo(tool: ToolDefinition): void {
  console.log(chalk.blue(`🔧 工具信息: ${tool.name}`));
  console.log('');

  console.log(chalk.cyan('基本信息:'));
  console.log(`  名称: ${chalk.yellow(tool.name)}`);
  console.log(`  描述: ${tool.description}`);
  if (tool.version) {
    console.log(`  版本: ${chalk.dim(tool.version)}`);
  }
  if (tool.author) {
    console.log(`  作者: ${tool.author}`);
  }
  if (tool.category) {
    console.log(`  分类: ${chalk.green(tool.category)}`);
  }
  if (tool.tags && tool.tags.length > 0) {
    console.log(`  标签: ${chalk.gray(tool.tags.join(', '))}`);
  }
  console.log('');

  console.log(chalk.cyan('参数说明:'));
  for (const [paramName, paramSchema] of Object.entries(tool.parameters)) {
    const required = tool.required?.includes(paramName) ? chalk.red('*') : ' ';
    const defaultValue =
      paramSchema.default !== undefined ? chalk.dim(` (默认: ${paramSchema.default})`) : '';
    const enumValues = paramSchema.enum ? chalk.dim(` (可选: ${paramSchema.enum.join(', ')})`) : '';

    console.log(
      `  ${required}${chalk.yellow(paramName)}: ${chalk.green(paramSchema.type)}${defaultValue}${enumValues}`
    );
    if (paramSchema.description) {
      console.log(`    ${chalk.gray(paramSchema.description)}`);
    }
  }

  if (tool.required && tool.required.length > 0) {
    console.log('');
    console.log(chalk.gray('* 表示必需参数'));
  }
}

/**
 * 显示工具执行结果
 */
function displayToolResult(response: any): void {
  const { result } = response;

  if (result.success) {
    console.log(chalk.green('✅ 执行成功'));
    if (result.duration) {
      console.log(chalk.gray(`⏱️  耗时: ${result.duration}ms`));
    }
    console.log('');
    console.log(chalk.cyan('执行结果:'));
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.log(chalk.red('❌ 执行失败'));
    console.log(chalk.red('错误信息:'), result.error);
  }

  if (result.metadata) {
    console.log('');
    console.log(chalk.gray('元数据:'));
    console.log(JSON.stringify(result.metadata, null, 2));
  }
}

/**
 * 生成工具文档
 */
function generateToolDocs(
  tools: ToolDefinition[],
  categories: Record<string, ToolDefinition[]>
): string {
  let docs = '# 工具文档\n\n';
  docs += `> 总计 ${tools.length} 个工具\n\n`;
  docs += '## 目录\n\n';

  // 生成目录
  for (const [category, categoryTools] of Object.entries(categories)) {
    docs += `- [${category.toUpperCase()}](#${category.toLowerCase()}) (${categoryTools.length})\n`;
  }
  docs += '\n';

  // 生成详细文档
  for (const [category, categoryTools] of Object.entries(categories)) {
    docs += `## ${category.toUpperCase()}\n\n`;

    for (const tool of categoryTools) {
      docs += `### ${tool.name}\n\n`;
      docs += `${tool.description}\n\n`;

      if (tool.version || tool.author) {
        docs += '**元信息:**\n';
        if (tool.version) docs += `- 版本: ${tool.version}\n`;
        if (tool.author) docs += `- 作者: ${tool.author}\n`;
        docs += '\n';
      }

      if (tool.tags && tool.tags.length > 0) {
        docs += `**标签:** \`${tool.tags.join('`、`')}\`\n\n`;
      }

      docs += '**参数:**\n\n';
      docs += '| 参数名 | 类型 | 必需 | 默认值 | 描述 |\n';
      docs += '|--------|------|------|--------|------|\n';

      for (const [paramName, paramSchema] of Object.entries(tool.parameters)) {
        const required = tool.required?.includes(paramName) ? '✅' : '❌';
        const defaultValue = paramSchema.default !== undefined ? `\`${paramSchema.default}\`` : '-';
        const description = paramSchema.description || '-';

        docs += `| \`${paramName}\` | \`${paramSchema.type}\` | ${required} | ${defaultValue} | ${description} |\n`;
      }

      docs += '\n---\n\n';
    }
  }

  return docs;
}

/**
 * 生成测试参数
 */
function generateTestParams(tool: ToolDefinition): Record<string, any> {
  const testParams: Record<string, any> = {};

  for (const [paramName, paramSchema] of Object.entries(tool.parameters)) {
    if (paramSchema.default !== undefined) {
      testParams[paramName] = paramSchema.default;
    } else if (paramSchema.enum && paramSchema.enum.length > 0) {
      testParams[paramName] = paramSchema.enum[0];
    } else {
      switch (paramSchema.type) {
        case 'string':
          testParams[paramName] = 'test';
          break;
        case 'number':
          testParams[paramName] = 42;
          break;
        case 'boolean':
          testParams[paramName] = true;
          break;
        case 'array':
          testParams[paramName] = [];
          break;
        case 'object':
          testParams[paramName] = {};
          break;
      }
    }
  }

  return testParams;
}
