import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
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