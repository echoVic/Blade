import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,  // 暂时禁用类型声明生成以简化调试
  clean: true,
  external: [
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
    'events'
  ]
});