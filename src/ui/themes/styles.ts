/**
 * UI样式配置
 */

import chalk from 'chalk';

export const UIStyles = {
  // 文本样式
  text: {
    bold: (text: string) => chalk.bold(text),
    italic: (text: string) => chalk.italic(text),
    underline: (text: string) => chalk.underline(text),
    strikethrough: (text: string) => chalk.strikethrough(text),
    dim: (text: string) => chalk.dim(text),
  },

  // 状态样式
  status: {
    success: (text: string) => chalk.green(text),
    error: (text: string) => chalk.red(text),
    warning: (text: string) => chalk.yellow(text),
    info: (text: string) => chalk.blue(text),
    muted: (text: string) => chalk.gray(text),
  },

  // 语义化样式
  semantic: {
    primary: (text: string) => chalk.blue(text),
    secondary: (text: string) => chalk.gray(text),
    accent: (text: string) => chalk.magenta(text),
    highlight: (text: string) => chalk.bgYellow.black(text),
  },

  // 标题样式
  heading: {
    h1: (text: string) => chalk.bold.blue(text),
    h2: (text: string) => chalk.bold.cyan(text),
    h3: (text: string) => chalk.bold.green(text),
    h4: (text: string) => chalk.bold.yellow(text),
  },

  // 特殊组件样式
  component: {
    header: (text: string) => chalk.bold.blue(text),
    section: (text: string) => chalk.cyan(text),
    label: (text: string) => chalk.white(text),
    value: (text: string) => chalk.green(text),
    code: (text: string) => chalk.gray.bgBlack(` ${text} `),
    quote: (text: string) => chalk.italic.gray(text),
  },

  // 图标样式
  icon: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
    rocket: '🚀',
    gear: '⚙️',
    chat: '💬',
    tools: '🔧',
    config: '📋',
    mcp: '🔗',
  },

  // 边框和分隔符
  border: {
    line: (length: number = 50) => chalk.gray('─'.repeat(length)),
    doubleLine: (length: number = 50) => chalk.gray('═'.repeat(length)),
    box: {
      top: '┌',
      bottom: '└',
      left: '│',
      right: '│',
      horizontal: '─',
      vertical: '│',
    },
  },
} as const;

// 便捷方法
export const $ = {
  success: UIStyles.status.success,
  error: UIStyles.status.error,
  warning: UIStyles.status.warning,
  info: UIStyles.status.info,
  muted: UIStyles.status.muted,
  bold: UIStyles.text.bold,
  dim: UIStyles.text.dim,
  header: UIStyles.component.header,
  code: UIStyles.component.code,
};
