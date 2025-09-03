#!/usr/bin/env node

import { build } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// CLI 包的外部依赖
const cliExternal = [
  'react',
  'react-dom',
  'ink',
  'zod',
  'axios',
  'child_process',
  'fs',
  'path',
  'os',
  'https',
  'crypto',
  'util',
  'events',
  '@modelcontextprotocol/sdk',
  'commander',
  'chalk',
  'inquirer',
  'ws',
  '@blade-kit/core' // CLI 依赖 Core 包
];

// Core 包的外部依赖
const coreExternal = [
  'zod',
  'axios',
  'child_process',
  'fs',
  'path',
  'os',
  'https',
  'crypto',
  'util',
  'events',
  '@modelcontextprotocol/sdk',
  'ws'
];

// 构建 CLI 包
async function buildCLI() {
  console.log('Building CLI bundle...');
  
  const cliDistDir = join(rootDir, 'packages/cli/dist');
  const cliBundleDir = join(rootDir, 'packages/cli/bundle');
  
  // 清理之前的构建
  if (existsSync(cliBundleDir)) {
    rmSync(cliBundleDir, { recursive: true });
  }
  mkdirSync(cliBundleDir, { recursive: true });
  
  const cliPath = join(cliDistDir, 'cli.js');
  if (!existsSync(cliPath)) {
    console.error('CLI dist file not found. Please run "tsc --build" first.');
    process.exit(1);
  }
  
  await build({
    entryPoints: [cliPath],
    bundle: true,
    platform: 'node',
    target: 'node16',
    format: 'esm',
    outfile: join(cliBundleDir, 'cli.js'),
    external: cliExternal,
    banner: {
      js: '#!/usr/bin/env node',
    },
    minify: true,
    sourcemap: true,
  });
  
  // 设置可执行权限
  const fs = await import('fs');
  try {
    fs.chmodSync(join(cliBundleDir, 'cli.js'), '755');
  } catch (err) {
    console.warn('Warning: Could not set executable permissions on CLI bundle');
  }
  
  console.log('CLI bundle built successfully!');
  console.log(`Bundle location: ${cliBundleDir}`);
}

// 构建 Core 包
async function buildCore() {
  console.log('Building Core bundle...');
  
  const coreDistDir = join(rootDir, 'packages/core/dist');
  const coreBundleDir = join(rootDir, 'packages/core/bundle');
  
  // 清理之前的构建
  if (existsSync(coreBundleDir)) {
    rmSync(coreBundleDir, { recursive: true });
  }
  mkdirSync(coreBundleDir, { recursive: true });
  
  const coreIndexPath = join(coreDistDir, 'index.js');
  if (!existsSync(coreIndexPath)) {
    console.error('Core dist file not found. Please run "tsc --build" first.');
    process.exit(1);
  }
  
  await build({
    entryPoints: [coreIndexPath],
    bundle: true,
    platform: 'node',
    target: 'node16',
    format: 'esm',
    outfile: join(coreBundleDir, 'index.js'),
    external: coreExternal,
    minify: true,
    sourcemap: true,
  });
  
  console.log('Core bundle built successfully!');
  console.log(`Bundle location: ${coreBundleDir}`);
}

// 复制类型定义文件
async function copyTypeDefinitions() {
  console.log('Copying type definitions...');
  
  // 复制 CLI 的类型定义
  const cliDistDir = join(rootDir, 'packages/cli/dist');
  const cliBundleDir = join(rootDir, 'packages/cli/bundle');
  
  const cliTypesFile = join(cliDistDir, 'cli.d.ts');
  if (existsSync(cliTypesFile)) {
    mkdirSync(join(cliBundleDir, 'types'), { recursive: true });
    copyFileSync(
      cliTypesFile,
      join(cliBundleDir, 'types', 'cli.d.ts')
    );
    console.log('CLI type definitions copied successfully!');
  } else {
    console.log('CLI type definitions not found, skipping...');
  }
  
  // 复制 Core 的类型定义
  const coreDistDir = join(rootDir, 'packages/core/dist');
  const coreBundleDir = join(rootDir, 'packages/core/bundle');
  
  const coreTypesFile = join(coreDistDir, 'index.d.ts');
  if (existsSync(coreTypesFile)) {
    mkdirSync(join(coreBundleDir, 'types'), { recursive: true });
    copyFileSync(
      coreTypesFile,
      join(coreBundleDir, 'types', 'index.d.ts')
    );
    console.log('Core type definitions copied successfully!');
  } else {
    console.log('Core type definitions not found, skipping...');
  }
}

// 主构建函数
async function main() {
  try {
    console.log('Starting bundle build process...');
    
    // 根据命令行参数决定构建哪个包
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--all')) {
      // 构建所有包
      await buildCore();
      await buildCLI();
      await copyTypeDefinitions();
      console.log('All bundles built successfully!');
    } else if (args.includes('core')) {
      // 只构建 Core 包
      await buildCore();
      await copyTypeDefinitions();
      console.log('Core bundle built successfully!');
    } else if (args.includes('cli')) {
      // 只构建 CLI 包
      await buildCLI();
      await copyTypeDefinitions();
      console.log('CLI bundle built successfully!');
    } else {
      console.error('Invalid argument. Use "core", "cli", or "--all"');
      process.exit(1);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// 运行构建
main();