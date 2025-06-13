import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['dotenv'],
  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: '#!/usr/bin/env node',
      };
    }
    return {};
  },
});
