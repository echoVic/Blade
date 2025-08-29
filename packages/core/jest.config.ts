import type { Config } from 'jest';

const config: Config = {
  preset: '../../../jest.config.js',
  displayName: 'CORE',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/test/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts}',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage/core',
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  moduleNameMapping: {
    '^@/(.+)$': '<rootDir>/src/$1',
    '^@blade-ai/ui$': '<rootDir>/../ui/src/index.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      }
    }]
  },
  globals: {
    'ts-jest': {
      useESM: true,
      isolatedModules: true
    }
  }
};

export default config;