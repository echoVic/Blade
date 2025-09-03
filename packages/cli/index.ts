#!/usr/bin/env node

/**
 * Blade CLI 总入口文件
 *
 * @description
 * 这个文件作为命令行工具的可执行入口。它的主要职责是：
 * 1. 设置 Node.js shebang，确保脚本由正确的解释器执行。
 * 2. 导入并启动核心应用逻辑。
 * 3. 提供一个顶层的全局错误捕获机制，防止应用在启动阶段因未捕获的异常而崩溃，
 *    并以友好的方式向用户报告错误。
 */

import { main } from './src/blade.js';

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 发生了未处理的 Promise Rejection:');
  console.error(reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 发生了未捕获的异常:');
  console.error(error);
  process.exit(1);
});

// 启动应用
async function run() {
  try {
    await main();
  } catch (error) {
    console.error('❌ 应用启动失败:');
    console.error(error);
    process.exit(1);
  }
}

run();
