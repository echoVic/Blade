# Blade UI 主题系统使用文档

## 目录

1. [概述](#概述)
2. [核心概念](#核心概念)
3. [快速开始](#快速开始)
4. [主题配置](#主题配置)
5. [设计令牌](#设计令牌)
6. [组件主题化](#组件主题化)
7. [CLI工具](#cli工具)
8. [API参考](#api参考)
9. [最佳实践](#最佳实践)
10. [故障排除](#故障排除)

## 概述

Blade UI 主题系统是一个功能强大且灵活的主题管理解决方案，基于 Design Tokens 标准构建。它提供了：

- 🎨 **多种内置主题**：7+种精心设计的内置主题
- 🎯 **设计令牌系统**：基于Design Tokens标准的设计系统
- 🌓 **暗色模式支持**：完整的暗色主题支持
- 🔧 **主题定制**：支持完全自定义主题
- 📱 **响应式设计**：支持响应式主题适配
- ⚡ **高性能**：优化的主题访问和渲染性能

## 核心概念

### 设计令牌 (Design Tokens)

设计令牌是设计和开发中使用的视觉设计原子。它们是抽象的值（如颜色、间距、字体大小等），用于维护设计系统的统一性。

```ts
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
```

### 主题引擎 (Theme Engine)

主题引擎是主题系统的核心，负责主题管理、令牌解析、验证和应用。

### 主题提供者 (Theme Provider)

Theme Provider 是 React Context Provider，用于在应用中提供主题上下文。

## 快速开始

### 安装

```bash
npm install @blade/ui
# 或
yarn add @blade/ui
# 或
pnpm add @blade/ui
```

### 基本使用

```jsx
import { ThemeProvider, useToken, useTheme } from '@blade/ui';

function App() {
  return (
    <ThemeProvider>
      <MyComponent />
    </ThemeProvider>
  );
}

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
```

## 主题配置

### 内置主题

Blade UI 提供了多种内置主题：

| 主题ID | 名称 | 类型 | 描述 |
|--------|------|------|------|
| default | Default | 亮色 | 默认主题，适用于大多数应用场景 |
| dark | Dark | 暗色 | 暗色主题，减少眼部疲劳 |
| high-contrast | High Contrast | 亮色 | 高对比度主题，提高可访问性 |
| compact | Compact | 亮色 | 紧凑主题，节省空间 |
| spacious | Spacious | 亮色 | 宽松主题，增加间距 |
| colorful | Colorful | 亮色 | 彩色主题，丰富多彩 |
| monochrome | Monochrome | 亮色 | 单色主题，简约优雅 |

### 使用内置主题

```jsx
import { ThemeProvider } from '@blade/ui';

function App() {
  return (
    <ThemeProvider initialTheme="dark">
      <YourApp />
    </ThemeProvider>
  );
}
```

### 创建自定义主题

```js
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
```

### 使用自定义主题

```jsx
import { ThemeProvider } from '@blade/ui';

function App() {
  return (
    <ThemeProvider 
      initialTheme="my-theme"
      customThemes={[customTheme]}
    >
      <YourApp />
    </ThemeProvider>
  );
}
```

## 设计令牌

### 颜色令牌

颜色令牌分为以下几类：

#### 基础颜色 (Base Colors)
```js
{
  white: '#FFFFFF',
  black: '#000000',
  gray: { 50: '#F9FAFB', ..., 900: '#111827' },
  neutral: { 50: '#FAFAFA', ..., 900: '#171717' }
}
```

#### 语义化颜色 (Semantic Colors)
```js
{
  primary: { 50: '#EFF6FF', ..., 900: '#1E3A8A' },
  secondary: { 50: '#F3F4F6', ..., 900: '#030712' },
  accent: { 50: '#FEF3C7', ..., 900: '#7C2D12' },
  success: { 50: '#F0FDF4', ..., 900: '#14532D' },
  warning: { 50: '#FFFBEB', ..., 900: '#78350F' },
  error: { 50: '#FEF2F2', ..., 900: '#7F1D1D' },
  info: { 50: '#EFF6FF', ..., 900: '#1E3A8A' }
}
```

#### 功能性颜色 (Functional Colors)
```js
{
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    // ...
  },
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    // ...
  }
}
```

### 排版令牌

#### 字体族
```js
{
  sans: ['Inter', 'system-ui', 'sans-serif'],
  serif: ['Georgia', 'Times New Roman', 'serif'],
  mono: ['Consolas', 'Monaco', 'monospace'],
  display: ['Oswald', 'Arial', 'sans-serif']
}
```

#### 字体大小
```js
{
  xs: 0.75,    // 12px
  sm: 0.875,   // 14px
  base: 1,     // 16px
  lg: 1.125,   // 18px
  xl: 1.25,    // 20px
  '2xl': 1.5,  // 24px
  // ...
}
```

### 使用令牌

```jsx
import { useToken } from '@blade/ui';

function MyComponent() {
  const primaryColor = useToken('colors.semantic.primary.500');
  const fontSize = useToken('typography.fontSize.base');
  
  return (
    <div style={{
      color: primaryColor,
      fontSize: `${fontSize}rem`
    }}>
      使用设计令牌的组件
    </div>
  );
}
```

## 组件主题化

### 内置组件

Blade UI 提供了多种主题化组件：

#### Text 组件
```jsx
import { Text } from '@blade/ui';

function MyText() {
  return (
    <>
      <Text variant="primary">主要文本</Text>
      <Text variant="secondary">次要文本</Text>
      <Text variant="success">成功文本</Text>
      <Text variant="warning">警告文本</Text>
      <Text variant="error">错误文本</Text>
    </>
  );
}
```

#### Button 组件
```jsx
import { Button } from '@blade/ui';

function MyButtons() {
  return (
    <>
      <Button variant="primary">主要按钮</Button>
      <Button variant="secondary">次要按钮</Button>
      <Button variant="success">成功按钮</Button>
      <Button variant="warning">警告按钮</Button>
      <Button variant="error">错误按钮</Button>
      <Button variant="ghost">幽灵按钮</Button>
    </>
  );
}
```

#### Box 组件
```jsx
import { Box } from '@blade/ui';

function MyLayout() {
  return (
    <Box variant="container">
      <Box variant="card">
        <Box variant="section">
          内容区域
        </Box>
      </Box>
    </Box>
  );
}
```

### 自定义组件主题化

```jsx
import { useToken, useStyles } from '@blade/ui';

function CustomComponent() {
  const styles = useStyles((theme) => ({
    container: {
      padding: `${theme.tokens.spacing.component.padding.md}rem`,
      backgroundColor: theme.tokens.colors.functional.background.surface,
      borderRadius: `${theme.tokens.border.radius.md}rem`,
      border: `${theme.tokens.border.width.normal}rem solid ${theme.tokens.colors.border.default}`,
    },
    title: {
      color: theme.tokens.colors.text.primary,
      fontSize: `${theme.tokens.typography.fontSize.xl}rem`,
      fontWeight: theme.tokens.typography.fontWeight.semibold,
    }
  }));

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>自定义组件</h2>
      <p>这是一个主题化的自定义组件</p>
    </div>
  );
}
```

## CLI工具

Blade UI 提供了强大的CLI工具来管理和开发主题。

### 安装CLI
```bash
npm install -g @blade/ui-cli
# 或
yarn global add @blade/ui-cli
```

### 常用命令

#### 列出主题
```bash
blade-theme list
blade-theme list --detailed
```

#### 导出主题
```bash
# 导出为JSON
blade-theme export default -f json -o theme.json

# 导出为CSS
blade-theme export default -f css -o theme.css

# 导出为SCSS
blade-theme export default -f scss -o theme.scss
```

#### 验证主题
```bash
blade-theme validate theme.json
```

#### 创建自定义主题
```bash
blade-theme create "My Theme" -b default -o my-theme.json
```

#### 生成文档
```bash
blade-theme docs
blade-theme docs default
```

## API参考

### ThemeProvider Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| children | ReactNode | - | 子组件 |
| initialTheme | string | 'default' | 初始主题ID |
| initialMode | 'light' \| 'dark' | 'light' | 初始主题模式 |
| options | ThemeHookOptions | {} | 主题选项 |

### ThemeHookOptions

```ts
interface ThemeHookOptions {
  syncWithSystem?: boolean;  // 同步系统主题
  persistTheme?: boolean;    // 持久化主题偏好
  enableTransition?: boolean; // 启用过渡动画
  defaultTheme?: string;     // 默认主题
  defaultMode?: 'light' \| 'dark'; // 默认模式
}
```

### Hooks

#### useTheme()
获取当前主题上下文。

```ts
const { theme, mode, setTheme, setMode } = useTheme();
```

#### useToken(path)
获取指定路径的令牌值。

```ts
const color = useToken('colors.semantic.primary.500');
```

#### useThemeMode()
获取和设置主题模式。

```ts
const [mode, setMode] = useThemeMode();
```

#### useThemeSwitcher()
获取和设置主题。

```ts
const [themeId, setTheme] = useThemeSwitcher();
```

## 最佳实践

### 性能优化

1. **令牌缓存**：主题系统内置缓存机制，自动缓存频繁访问的令牌值。

2. **懒加载**：大型应用可以使用懒加载来减少初始加载时间：
```jsx
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
```

### 无障碍性

1. **高对比度模式**：
```jsx
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
```

2. **颜色对比度检查**：确保文本和背景的对比度符合WCAG标准。

### 响应式设计

1. **媒体查询**：
```jsx
import { useResponsiveStyles } from '@blade/ui';

function ResponsiveComponent() {
  const styles = useResponsiveStyles({
    padding: '1rem',
    fontSize: '1rem'
  }, true);
  
  return <div style={styles}>响应式组件</div>;
}
```

## 故障排除

### 常见问题

#### 1. 主题未正确应用
确保组件包装在`ThemeProvider`中：
```jsx
// ❌ 错误
function App() {
  return <MyComponent />;
}

// ✅ 正确
function App() {
  return (
    <ThemeProvider>
      <MyComponent />
    </ThemeProvider>
  );
}
```

#### 2. 令牌值未定义
检查令牌路径是否正确：
```js
// ❌ 错误
useToken('colors.primary'); // 路径不完整

// ✅ 正确
useToken('colors.semantic.primary.500');
```

#### 3. 自定义主题不生效
确保自定义主题已正确注册：
```jsx
<ThemeProvider 
  initialTheme="my-theme"
  customThemes={[myCustomTheme]} // 确保已传入
>
  <App />
</ThemeProvider>
```

### 调试工具

#### 主题调试器
```jsx
import { ThemeToolbar } from '@blade/ui';

function App() {
  return (
    <div>
      <ThemeToolbar defaultOpen={false} />
      <YourApp />
    </div>
  );
}
```

#### 主题浏览器
```jsx
import { ThemeTokenBrowser } from '@blade/ui';

function TokenBrowser() {
  return <ThemeTokenBrowser searchable defaultExpanded />;
}
```

## 贡献

欢迎为Blade UI主题系统贡献代码！请遵循以下步骤：

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

Blade UI 主题系统采用 MIT 许可证。详细信息请参见 [LICENSE](./LICENSE) 文件。

## 支持

如有问题，请提交 GitHub Issue 或联系我们。

---
*Blade UI Theme System v1.0.0*
*文档最后更新: 2025年8月*