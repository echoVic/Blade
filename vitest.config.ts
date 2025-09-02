import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,babel}.config.*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/test/**',
        '**/__tests__/**',
        '**/*.{test,spec}.{js,ts,jsx,tsx}',
        '**/scripts/**',
        '**/coverage/**'
      ]
    },
    setupFiles: [
      './tests/setup.ts'
    ],
    // 添加TypeScript配置
    typecheck: {
      tsconfig: './tsconfig.test.json'
    }
  },
  resolve: {
    alias: {
      '@blade-ai/core': resolve(__dirname, 'packages/core/src'),
      '@blade-ai/cli': resolve(__dirname, 'packages/cli/src')
    }
  }
})