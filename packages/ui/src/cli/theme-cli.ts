#!/usr/bin/env node

/**
 * Blade UI主题系统CLI工具
 * 提供主题生成、验证、导出等命令
 */

import { Command } from 'commander';
import { ThemeGenerator } from '../tools/theme-generator';
import { builtinThemes } from '../themes/builtin-themes';
import ThemeValidator from '../themes/theme-validator';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('blade-theme')
  .description('Blade UI 主题系统CLI工具')
  .version('1.0.0');

// 主题生成器命令
program
  .command('generate')
  .description('主题生成器命令')
  .action(() => {
    const generator = new ThemeGenerator();
    generator.run();
  });

// 验证主题命令
program
  .command('validate')
  .description('验证主题配置文件')
  .argument('<file>', '主题文件路径')
  .option('-l, --level <level>', '验证级别 (strict|normal|loose)', 'normal')
  .action((file, options) => {
    validateTheme(file, options);
  });

// 列出内置主题命令
program
  .command('list')
  .description('列出所有内置主题')
  .option('-d, --detailed', '显示详细信息')
  .action((options) => {
    listThemes(options);
  });

// 导出主题命令
program
  .command('export')
  .description('导出主题为不同格式')
  .argument('<theme-id>', '主题ID')
  .option('-f, --format <format>', '输出格式 (json|css|scss|tailwind)', 'json')
  .option('-o, --output <file>', '输出文件路径')
  .action((themeId, options) => {
    exportTheme(themeId, options);
  });

// 创建自定义主题命令
program
  .command('create')
  .description('创建自定义主题')
  .argument('<name>', '主题名称')
  .option('-b, --base <theme-id>', '基础主题', 'default')
  .option('-o, --output <file>', '输出文件路径')
  .option('-c, --colors <colors>', '自定义颜色 (JSON格式)')
  .action((name, options) => {
    createCustomTheme(name, options);
  });

// 主题对比命令
program
  .command('diff')
  .description('对比两个主题的差异')
  .argument('<theme1>', '第一个主题ID')
  .argument('<theme2>', '第二个主题ID')
  .option('-t, --type <type>', '对比类型 (all|colors|typography|spacing)', 'all')
  .action((theme1, theme2, options) => {
    diffThemes(theme1, theme2, options);
  });

// 主题文档生成命令
program
  .command('docs')
  .description('生成主题文档')
  .argument('[theme-id]', '主题ID (可选，不指定则生成所有主题文档)')
  .option('-o, --output <dir>', '输出目录', './theme-docs')
  .option('-f, --format <format>', '文档格式 (html|md)', 'md')
  .action((themeId, options) => {
    generateDocs(themeId, options);
  });

/**
 * 验证主题
 */
function validateTheme(filePath: string, options: { level: 'strict' | 'normal' | 'loose' }) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const theme = JSON.parse(fileContent);
    
    const validator = new ThemeValidator(options.level);
    const result = validator.validateTheme(theme);
    
    if (result.isValid) {
      console.log('✅ 主题验证通过');
      console.log(`   警告: ${result.warnings.length}`);
      console.log(`   建议: ${result.recommendations.length}`);
    } else {
      console.log('❌ 主题验证失败');
      console.log(`   错误: ${result.errors.length}`);
      console.log(`   警告: ${result.warnings.length}`);
      console.log(`   建议: ${result.recommendations.length}`);
      
      if (result.errors.length > 0) {
        console.log('\n错误详情:');
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.path}: ${error.message}`);
        });
      }
    }
  } catch (error) {
    console.error('验证失败:', error instanceof Error ? error.message : '未知错误');
    process.exit(1);
  }
}

/**
 * 列出主题
 */
function listThemes(options: { detailed: boolean }) {
  console.log('🎨 Blade UI 内置主题列表');
  console.log('========================');
  
  Object.entries(builtinThemes).forEach(([id, theme]) => {
    console.log(`🔹 ${id}: ${theme.name}`);
    
    if (options.detailed) {
      console.log(`   描述: ${theme.description}`);
      console.log(`   作者: ${theme.author}`);
      console.log(`   版本: ${theme.version}`);
      console.log(`   暗色主题: ${theme.isDark ? '是' : '否'}`);
      console.log('');
    }
  });
}

/**
 * 导出主题
 */
function exportTheme(
  themeId: string, 
  options: { format: string; output?: string }
) {
  const theme = builtinThemes[themeId];
  if (!theme) {
    console.error(`❌ 找不到主题 '${themeId}'`);
    process.exit(1);
  }

  let output: string;
  
  switch (options.format) {
    case 'json':
      output = JSON.stringify(theme, null, 2);
      break;
    case 'css':
      output = convertToCSS(theme);
      break;
    case 'scss':
      output = convertToSCSS(theme);
      break;
    case 'tailwind':
      output = convertToTailwind(theme);
      break;
    default:
      console.error(`❌ 不支持的格式 '${options.format}'`);
      process.exit(1);
  }

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`✅ 主题已导出到: ${options.output}`);
  } else {
    console.log(output);
  }
}

/**
 * 创建自定义主题
 */
function createCustomTheme(
  name: string,
  options: { base: string; output?: string; colors?: string }
) {
  const baseTheme = builtinThemes[options.base];
  if (!baseTheme) {
    console.error(`❌ 找不到基础主题 '${options.base}'`);
    process.exit(1);
  }

  let customColors = {};
  if (options.colors) {
    try {
      customColors = JSON.parse(options.colors);
    } catch (error) {
      console.error('❌ 颜色配置格式无效');
      process.exit(1);
    }
  }

  const newTheme = {
    ...baseTheme,
    id: generateThemeId(name),
    name,
    description: `自定义主题: ${name}`,
    version: '1.0.0',
    author: 'Blade UI Theme Generator',
  };

  // 应用自定义颜色
  if (Object.keys(customColors).length > 0) {
    newTheme.tokens.colors = {
      ...newTheme.tokens.colors,
      ...customColors,
    };
  }

  const output = JSON.stringify(newTheme, null, 2);
  
  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`✅ 自定义主题已创建: ${options.output}`);
  } else {
    console.log(output);
  }
}

/**
 * 对比主题
 */
function diffThemes(
  theme1Id: string, 
  theme2Id: string,
  options: { type: string }
) {
  const theme1 = builtinThemes[theme1Id];
  const theme2 = builtinThemes[theme2Id];
  
  if (!theme1) {
    console.error(`❌ 找不到主题 '${theme1Id}'`);
    process.exit(1);
  }
  
  if (!theme2) {
    console.error(`❌ 找不到主题 '${theme2Id}'`);
    process.exit(1);
  }

  console.log(`🔄 对比主题: ${theme1.name} vs ${theme2.name}`);
  console.log('========================');
  
  switch (options.type) {
    case 'colors':
      diffColors(theme1.tokens.colors, theme2.tokens.colors);
      break;
    case 'typography':
      diffTypography(theme1.tokens.typography, theme2.tokens.typography);
      break;
    case 'spacing':
      diffSpacing(theme1.tokens.spacing, theme2.tokens.spacing);
      break;
    default:
      diffColors(theme1.tokens.colors, theme2.tokens.colors);
      diffTypography(theme1.tokens.typography, theme2.tokens.typography);
      diffSpacing(theme1.tokens.spacing, theme2.tokens.spacing);
  }
}

/**
 * 生成文档
 */
function generateDocs(
  themeId: string | undefined,
  options: { output: string; format: string }
) {
  // 确保输出目录存在
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  if (themeId) {
    // 生成单个主题文档
    const theme = builtinThemes[themeId];
    if (!theme) {
      console.error(`❌ 找不到主题 '${themeId}'`);
      process.exit(1);
    }
    
    generateThemeDocs(theme, options.output, options.format);
  } else {
    // 生成所有主题文档
    Object.values(builtinThemes).forEach(theme => {
      generateThemeDocs(theme, options.output, options.format);
    });
  }
  
  console.log(`✅ 文档已生成到: ${options.output}`);
}

/**
 * 转换为主题到CSS
 */
function convertToCSS(theme: any): string {
  let css = `/* ${theme.name} 主题 */\n`;
  css += ':root {\n';
  
  // 颜色变量
  Object.entries(theme.tokens.colors.base).forEach(([key, value]) => {
    if (typeof value === 'string') {
      css += `  --color-${key}: ${value};\n`;
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        css += `  --color-${key}-${subKey}: ${subValue};\n`;
      });
    }
  });
  
  // 排版变量
  Object.entries(theme.tokens.typography.fontSize).forEach(([key, value]) => {
    css += `  --font-size-${key}: ${value}rem;\n`;
  });
  
  css += '}\n';
  return css;
}

/**
 * 转换为主题到SCSS
 */
function convertToSCSS(theme: any): string {
  let scss = `// ${theme.name} 主题\n`;
  
  // 颜色变量
  Object.entries(theme.tokens.colors.base).forEach(([key, value]) => {
    if (typeof value === 'string') {
      scss += `$color-${key}: ${value};\n`;
    } else if (typeof value === 'object') {
      scss += `$color-${key}: (\n`;
      Object.entries(value).forEach(([subKey, subValue]) => {
        scss += `  ${subKey}: ${subValue},\n`;
      });
      scss += ');\n';
    }
  });
  
  return scss;
}

/**
 * 转换为主题到Tailwind配置
 */
function convertToTailwind(theme: any): string {
  let tailwind = `// ${theme.name} Tailwind 配置\n`;
  tailwind += 'module.exports = {\n';
  tailwind += '  theme: {\n';
  tailwind += '    extend: {\n';
  
  // 颜色扩展
  tailwind += '      colors: {\n';
  Object.entries(theme.tokens.colors.semantic).forEach(([key, value]) => {
    tailwind += `        '${key}': {\n`;
    Object.entries(value).forEach(([subKey, subValue]) => {
      tailwind += `          ${subKey}: '${subValue}',\n`;
    });
    tailwind += '        },\n';
  });
  tailwind += '      },\n';
  
  tailwind += '    },\n';
  tailwind += '  },\n';
  tailwind += '}\n';
  
  return tailwind;
}

/**
 * 对比颜色
 */
function diffColors(colors1: any, colors2: any) {
  console.log('🎨 颜色对比:');
  
  const allKeys = new Set([
    ...Object.keys(colors1.base),
    ...Object.keys(colors2.base)
  ]);
  
  allKeys.forEach(key => {
    const value1 = colors1.base[key];
    const value2 = colors2.base[key];
    
    if (value1 !== value2) {
      console.log(`   ${key}: ${value1} → ${value2}`);
    }
  });
}

/**
 * 对比排版
 */
function diffTypography(typography1: any, typography2: any) {
  console.log('🔤 排版对比:');
  
  const allKeys = new Set([
    ...Object.keys(typography1.fontSize),
    ...Object.keys(typography2.fontSize)
  ]);
  
  allKeys.forEach(key => {
    const value1 = typography1.fontSize[key];
    const value2 = typography2.fontSize[key];
    
    if (value1 !== value2) {
      console.log(`   font-size-${key}: ${value1} → ${value2}`);
    }
  });
}

/**
 * 对比间距
 */
function diffSpacing(spacing1: any, spacing2: any) {
  console.log('📏 间距对比:');
  
  const allKeys = new Set([
    ...Object.keys(spacing1.base),
    ...Object.keys(spacing2.base)
  ]);
  
  allKeys.forEach(key => {
    const value1 = spacing1.base[key];
    const value2 = spacing2.base[key];
    
    if (value1 !== value2) {
      console.log(`   spacing-${key}: ${value1} → ${value2}`);
    }
  });
}

/**
 * 生成主题文档
 */
function generateThemeDocs(theme: any, outputDir: string, format: string) {
  const fileName = `${theme.id}.${format}`;
  const filePath = path.join(outputDir, fileName);
  
  let content: string;
  
  if (format === 'md') {
    content = generateMarkdownDocs(theme);
  } else {
    content = generateHTMLDocs(theme);
  }
  
  fs.writeFileSync(filePath, content);
}

/**
 * 生成Markdown文档
 */
function generateMarkdownDocs(theme: any): string {
  let md = `# ${theme.name} 主题\n\n`;
  md += `${theme.description}\n\n`;
  md += `**作者**: ${theme.author}\n\n`;
  md += `**版本**: ${theme.version}\n\n`;
  
  md += '## 颜色调色板\n\n';
  Object.entries(theme.tokens.colors.base).forEach(([key, value]) => {
    if (typeof value === 'object') {
      md += `### ${key}\n\n`;
      Object.entries(value).forEach(([subKey, subValue]) => {
        md += `- ${subKey}: \`${subValue}\`\n`;
      });
      md += '\n';
    }
  });
  
  md += '## 语义化颜色\n\n';
  Object.entries(theme.tokens.colors.semantic).forEach(([key, value]) => {
    md += `### ${key}\n\n`;
    Object.entries(value).forEach(([subKey, subValue]) => {
      md += `- ${subKey}: \`${subValue}\`\n`;
    });
    md += '\n';
  });
  
  return md;
}

/**
 * 生成HTML文档
 */
function generateHTMLDocs(theme: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${theme.name} 主题</title>
    <style>
        body { font-family: sans-serif; margin: 2rem; }
        h1, h2, h3 { color: #333; }
        .color-swatch { display: inline-block; width: 20px; height: 20px; border: 1px solid #ccc; margin-right: 5px; }
    </style>
</head>
<body>
    <h1>${theme.name} 主题</h1>
    <p>${theme.description}</p>
    <p><strong>作者</strong>: ${theme.author}</p>
    <p><strong>版本</strong>: ${theme.version}</p>
    
    <h2>颜色调色板</h2>
    ${Object.entries(theme.tokens.colors.base).map(([key, value]) => `
        <h3>${key}</h3>
        ${typeof value === 'object' ? 
          Object.entries(value).map(([subKey, subValue]) => 
            `<div><span class="color-swatch" style="background: ${subValue}"></span> ${subKey}: ${subValue}</div>`
          ).join('') : 
          `<div><span class="color-swatch" style="background: ${value}"></span> ${value}</div>`
        }
    `).join('')}
</body>
</html>
  `;
}

/**
 * 生成主题ID
 */
function generateThemeId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 运行程序
program.parse();