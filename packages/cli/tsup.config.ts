import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: '#!/usr/bin/env node',
      };
    }
    return {};
  },
  external: [
    'react',
    'react-dom',
    'ink',
    '@blade-ai/core'
  ]
});