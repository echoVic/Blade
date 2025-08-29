import type { Config } from 'jest';

const config: Config = {
  preset: '../../../jest.config.js',
  displayName: 'UI',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/test/**/*.test.{ts,tsx}'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.{ts,tsx}',
    '!src/**/*.example.{ts,tsx}'
  ],
  coverageDirectory: 'coverage/ui',
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  moduleNameMapping: {
    '^@/(.+)$': '<rootDir>/src/$1',
    '^@blade-ai/core$': '<rootDir>/../core/src/index.ts'
  },
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
    '@testing-library/jest-dom'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      }
    }],
    '^.+\\.(css|less|scss|sass)$': 'jest-transform-stub'
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
      isolatedModules: true
    }
  },
  // React Testing Library 配置
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  // 模拟样式文件
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/test/__mocks__/fileMock.js'
  }
};

export default config;