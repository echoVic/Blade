/**
 * 主题文档生成器
 * 用于生成主题系统的完整文档
 */

import fs from 'fs';
import path from 'path';
import type { ThemeConfig, DesignTokens } from '../types/design-tokens';
import { builtinThemes } from '../themes/builtin-themes';

export class ThemeDocumenter {
  private outputDir: string;

  constructor(outputDir: string = './docs') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  /**
   * 确保输出目录存在
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 生成完整文档
   */
  public generateDocumentation(): void {
    console.log('📝 生成主题系统文档...');
    
    // 生成主页
    this.generateHomePage();
    
    // 生成主题概览
    this.generateThemesOverview();
    
    // 生成每个主题的详细页面
    Object.entries(builtinThemes).forEach(([id, theme]) => {
      this.generateThemeDetailPage(id, theme);
    });
    
    // 生成设计令牌文档
    this.generateDesignTokensDocs();
    
    // 生成API参考
    this.generateAPIReference();
    
    // 生成使用指南
    this.generateUsageGuide();
    
    console.log(`✅ 文档已生成到: ${this.outputDir}`);
  }

  /**
   * 生成主页
   */
  private generateHomePage(): void {
    const content = `
# Blade UI 主题系统文档

欢迎使用 Blade UI 主题系统！这是一个功能强大的主题管理系统，支持多种预设主题和自定义主题。

## 功能特性

- 🎨 **多种内置主题**: 提供7+种精心设计的内置主题
- 🎯 **设计令牌系统**: 基于Design Tokens标准的设计系统
- 🌓 **暗色模式支持**: 完整的暗色主题支持
- 🔧 **主题定制**: 支持完全自定义主题
- 📱 **响应式设计**: 支持响应式主题适配
- ⚡ **高性能**: 优化的主题访问和渲染性能

## 快速开始

\`\`\`bash
# 安装依赖
npm install @blade/ui

# 使用默认主题
import { ThemeProvider } from '@blade/ui';
\`\`\`

## 目录

- [主题概览](themes/overview.md)
- [设计令牌](tokens/README.md)
- [API参考](api/README.md)
- [使用指南](guide/README.md)

---
*Blade UI Theme System v1.0.0*
    `.trim();

    fs.writeFileSync(path.join(this.outputDir, 'README.md'), content);
  }

  /**
   * 生成主题概览
   */
  private generateThemesOverview(): void {
    const themesDir = path.join(this.outputDir, 'themes');
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true });
    }

    let content = `
# 主题概览

Blade UI 提供了多种内置主题，满足不同场景的需求。

## 内置主题列表

| 主题ID | 名称 | 类型 | 描述 |
|--------|------|------|------|
`;

    Object.entries(builtinThemes).forEach(([id, theme]) => {
      const type = theme.isDark ? '暗色' : '亮色';
      content += `| ${id} | ${theme.name} | ${type} | ${theme.description} |\n`;
    });

    content += `
## 主题使用

\`\`\`jsx
import { ThemeProvider } from '@blade/ui';

function App() {
  return (
    <ThemeProvider initialTheme="default">
      <YourApp />
    </ThemeProvider>
  );
}
\`\`\`

## 主题切换

\`\`\`jsx
import { useTheme } from '@blade/ui';

function ThemeSwitcher() {
  const [theme, setTheme] = useThemeSwitcher();
  
  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="default">默认主题</option>
      <option value="dark">暗色主题</option>
      <option value="colorful">彩色主题</option>
    </select>
  );
}
\`\`\`
    `.trim();

    fs.writeFileSync(path.join(themesDir, 'overview.md'), content);
  }

  /**
   * 生成主题详细页面
   */
  private generateThemeDetailPage(themeId: string, theme: ThemeConfig): void {
    const themesDir = path.join(this.outputDir, 'themes');
    const themeDir = path.join(themesDir, themeId);
    if (!fs.existsSync(themeDir)) {
      fs.mkdirSync(themeDir, { recursive: true });
    }

    let content = `
# ${theme.name} 主题

${theme.description}

## 基本信息

- **ID**: \`${theme.id}\`
- **作者**: ${theme.author}
- **版本**: ${theme.version}
- **类型**: ${theme.isDark ? '暗色' : '亮色'}

## 颜色调色板

### 基础颜色

| 颜色 | 值 |
|------|-----|
| White | \`${theme.tokens.colors.base.white}\` |
| Black | \`${theme.tokens.colors.base.black}\` |

### 灰度调色板

| 步骤 | 颜色 |
|------|------|
`;

    Object.entries(theme.tokens.colors.base.gray).forEach(([step, color]) => {
      content += `| ${step} | \`${color}\` |\n`;
    });

    content += `
### 语义化颜色

#### 主要颜色

| 步骤 | 颜色 |
|------|------|
`;

    Object.entries(theme.tokens.colors.semantic.primary).forEach(([step, color]) => {
      content += `| ${step} | \`${color}\` |\n`;
    });

    content += `
#### 成功颜色

| 步骤 | 颜色 |
|------|------|
`;

    Object.entries(theme.tokens.colors.semantic.success).forEach(([step, color]) => {
      content += `| ${step} | \`${color}\` |\n`;
    });

    content += `
## 排版系统

### 字体族

\`\`\`js
{
  sans: [${theme.tokens.typography.fontFamily.sans.map(f => `'${f}'`).join(', ')}],
  serif: [${theme.tokens.typography.fontFamily.serif.map(f => `'${f}'`).join(', ')}],
  mono: [${theme.tokens.typography.fontFamily.mono.map(f => `'${f}'`).join(', ')}]
}
\`\`\`

### 字体大小

| 名称 | 大小 (rem) | 大小 (px) |
|------|------------|-----------|
`;

    Object.entries(theme.tokens.typography.fontSize).forEach(([name, size]) => {
      const px = Math.round(size * 16);
      content += `| ${name} | ${size} | ${px} |\n`;
    });

    content += `
## 使用示例

\`\`\`jsx
import { ThemedButton } from '@blade/ui';

function MyComponent() {
  return (
    <ThemedButton variant="primary">
      ${theme.name} 主题按钮
    </ThemedButton>
  );
}
\`\`\`

---
*生成时间: ${new Date().toISOString()}*
    `.trim();

    fs.writeFileSync(path.join(themeDir, 'README.md'), content);
  }

  /**
   * 生成设计令牌文档
   */
  private generateDesignTokensDocs(): void {
    const tokensDir = path.join(this.outputDir, 'tokens');
    if (!fs.existsSync(tokensDir)) {
      fs.mkdirSync(tokensDir, { recursive: true });
    }

    const content = `
# 设计令牌 (Design Tokens)

Blade UI 主题系统基于 Design Tokens 标准，提供一致的设计变量。

## 什么是设计令牌？

设计令牌是设计和开发中使用的视觉设计原子。它们是抽象的值（如颜色、间距、字体大小等），用于维护设计系统的统一性。

## 令牌结构

\`\`\`ts
interface DesignTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  border: BorderTokens;
  shadow: ShadowTokens;
  animation: AnimationTokens;
  layout: LayoutTokens;
  gradient: GradientTokens;
}
\`\`\`

## 颜色令牌

颜色令牌分为以下几类：

### 基础颜色 (Base Colors)
- white: #FFFFFF
- black: #000000
- gray: 灰度调色板
- neutral: 中性调色板

### 语义化颜色 (Semantic Colors)
- primary: 主要颜色
- secondary: 次要颜色
- accent: 强调颜色
- success: 成功状态颜色
- warning: 警告状态颜色
- error: 错误状态颜色
- info: 信息状态颜色

### 功能性颜色 (Functional Colors)
- background: 背景颜色
- text: 文本颜色
- border: 边框颜色
- icon: 图标颜色
- interactive: 交互颜色

## 排版令牌

### 字体族
- sans: 无衬线字体
- serif: 衬线字体
- mono: 等宽字体
- display: 显示字体

### 字体大小
- xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl

### 字体粗细
- thin, light, normal, medium, semibold, bold, black

## 使用令牌

\`\`\`jsx
import { useToken } from '@blade/ui';

function MyComponent() {
  const primaryColor = useToken('colors.semantic.primary.500');
  const fontSize = useToken('typography.fontSize.base');
  
  return (
    <div style={{
      color: primaryColor,
      fontSize: \`\${fontSize}rem\`
    }}>
      使用设计令牌的组件
    </div>
  );
}
\`\`\`

## 自定义令牌

您可以通过以下方式添加自定义令牌：

\`\`\`js
const customTheme = {
  ...defaultTheme,
  customTokens: {
    'brand.primary': '#FF6B35',
    'layout.maxWidth': '1200px'
  }
};
\`\`\`
    `.trim();

    fs.writeFileSync(path.join(tokensDir, 'README.md'), content);
  }

  /**
   * 生成API参考
   */
  private generateAPIReference(): void {
    const apiDir = path.join(this.outputDir, 'api');
    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }

    const content = `
# API 参考

## ThemeProvider

主题提供者组件，用于包装应用并提供主题上下文。

### Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| children | ReactNode | - | 子组件 |
| initialTheme | string | 'default' | 初始主题ID |
| initialMode | 'light' \| 'dark' | 'light' | 初始主题模式 |
| options | ThemeHookOptions | {} | 主题选项 |

### ThemeHookOptions

\`\`\`ts
interface ThemeHookOptions {
  syncWithSystem?: boolean;  // 同步系统主题
  persistTheme?: boolean;    // 持久化主题偏好
  enableTransition?: boolean; // 启用过渡动画
  defaultTheme?: string;     // 默认主题
  defaultMode?: 'light' \| 'dark'; // 默认模式
}
\`\`\`

## Hooks

### useTheme()

获取当前主题上下文。

\`\`\`ts
const { theme, mode, setTheme, setMode } = useTheme();
\`\`\`

### useToken(path)

获取指定路径的令牌值。

\`\`\`ts
const color = useToken('colors.semantic.primary.500');
\`\`\`

### useThemeMode()

获取和设置主题模式。

\`\`\`ts
const [mode, setMode] = useThemeMode();
\`\`\`

### useThemeSwitcher()

获取和设置主题。

\`\`\`ts
const [themeId, setTheme] = useThemeSwitcher();
\`\`\`

## 组件

### ThemedButton

主题化按钮组件。

\`\`\`jsx
<ThemedButton variant="primary" onClick={handleClick}>
  点击我
</ThemedButton>
\`\`\`

### ThemedCard

主题化卡片组件。

\`\`\`jsx
<ThemedCard title="卡片标题">
  卡片内容
</ThemedCard>
\`\`\`

## 主题配置

### ThemeConfig

\`\`\`ts
interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  isDark: boolean;
  tokens: DesignTokens;
  customTokens?: Record<string, any>;
  components?: ComponentThemeConfig;
}
\`\`\`
    `.trim();

    fs.writeFileSync(path.join(apiDir, 'README.md'), content);
  }

  /**
   * 生成使用指南
   */
  private generateUsageGuide(): void {
    const guideDir = path.join(this.outputDir, 'guide');
    if (!fs.existsSync(guideDir)) {
      fs.mkdirSync(guideDir, { recursive: true });
    }

    const content = `
# 使用指南

## 安装

\`\`\`bash
npm install @blade/ui
# 或
yarn add @blade/ui
# 或
pnpm add @blade/ui
\`\`\`

## 基本使用

### 1. 包装应用

\`\`\`jsx
import { ThemeProvider } from '@blade/ui';

function App() {
  return (
    <ThemeProvider>
      <YourApp />
    </ThemeProvider>
  );
}
\`\`\`

### 2. 使用主题值

\`\`\`jsx
import { useToken, useTheme } from '@blade/ui';

function MyComponent() {
  const primaryColor = useToken('colors.semantic.primary.500');
  const { theme } = useTheme();
  
  return (
    <div style={{ 
      backgroundColor: theme.tokens.colors.functional.background.primary,
      color: primaryColor
    }}>
      使用主题的组件
    </div>
  );
}
\`\`\`

## 主题定制

### 创建自定义主题

\`\`\`js
import { defaultTheme } from '@blade/ui';

const customTheme = {
  ...defaultTheme,
  id: 'my-theme',
  name: '我的主题',
  tokens: {
    ...defaultTheme.tokens,
    colors: {
      ...defaultTheme.tokens.colors,
      semantic: {
        ...defaultTheme.tokens.colors.semantic,
        primary: {
          ...defaultTheme.tokens.colors.semantic.primary,
          500: '#FF6B35'
        }
      }
    }
  }
};
\`\`\`

### 使用自定义主题

\`\`\`jsx
<ThemeProvider 
  initialTheme="my-theme"
  customThemes={[customTheme]}
>
  <YourApp />
</ThemeProvider>
\`\`\`

## 主题切换

### 基本切换

\`\`\`jsx
import { useThemeSwitcher, useThemeMode } from '@blade/ui';

function ThemeControls() {
  const [theme, setTheme] = useThemeSwitcher();
  const [mode, setMode] = useThemeMode();
  
  return (
    <div>
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="default">默认</option>
        <option value="dark">暗色</option>
        <option value="colorful">彩色</option>
      </select>
      
      <button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>
        切换到{mode === 'light' ? '暗色' : '亮色'}模式
      </button>
    </div>
  );
}
\`\`\`

## 性能优化

### 令牌缓存

主题系统内置缓存机制，自动缓存频繁访问的令牌值。

### 懒加载

大型应用可以使用懒加载来减少初始加载时间：

\`\`\`jsx
import { lazy, Suspense } from 'react';
import { ThemeProvider } from '@blade/ui';

const LazyComponent = lazy(() => import('./LazyComponent'));

function App() {
  return (
    <ThemeProvider>
      <Suspense fallback={<div>加载中...</div>}>
        <LazyComponent />
      </Suspense>
    </ThemeProvider>
  );
}
\`\`\`

## 无障碍性

### 高对比度模式

\`\`\`jsx
import { useThemeAccessibility } from '@blade/ui';

function AccessibleComponent() {
  const { highContrast, toggleHighContrast } = useThemeAccessibility({
    highContrast: false
  });
  
  return (
    <button onClick={toggleHighContrast}>
      {highContrast ? '关闭高对比度' : '开启高对比度'}
    </button>
  );
}
\`\`\`

## 响应式设计

### 媒体查询

\`\`\`jsx
import { useResponsiveStyles } from '@blade/ui';

function ResponsiveComponent() {
  const styles = useResponsiveStyles({
    padding: '1rem',
    fontSize: '1rem'
  }, true);
  
  return <div style={styles}>响应式组件</div>;
}
\`\`\`

## 开发工具

### 主题调试器

\`\`\`jsx
import { ThemeToolbar } from '@blade/ui';

function App() {
  return (
    <div>
      <ThemeToolbar defaultOpen={false} />
      <YourApp />
    </div>
  );
}
\`\`\`

### 主题浏览器

\`\`\`jsx
import { ThemeTokenBrowser } from '@blade/ui';

function TokenBrowser() {
  return <ThemeTokenBrowser searchable defaultExpanded />;
}
\`\`\`
    `.trim();

    fs.writeFileSync(path.join(guideDir, 'README.md'), content);
  }
}

// 如果直接运行此文件，则生成文档
if (require.main === module) {
  const documenter = new ThemeDocumenter('./docs');
  documenter.generateDocumentation();
}

export default ThemeDocumenter;