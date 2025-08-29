import type { Config } from 'jest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function getConfig(): Promise<Config> {
  // 获取当前分支
  let branch = 'main';
  try {
    branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('无法获取git分支，使用默认分支main');
  }

  // 动态配置基于分支
  const isDevelopment = branch === 'feature/unified-configuration-system' || branch.startsWith('feature/');
  const isMain = branch === 'main';

  return {
    preset: 'ts-jest/presets/default-js-with-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/packages/*/src'],
    testMatch: [
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.test.tsx',
      '**/test/**/*.test.ts',
      '**/test/**/*.test.tsx'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transform: {
      '^.+\\.tsx?$': ['ts-jest', {
        useESM: true,
        tsconfig: {
          jsx: 'react-jsx'
        }
      }],
      '^.+\\.jsx?$': ['babel-jest', {
        presets: ['@babel/preset-env', '@babel/preset-react']
      }]
    },
    moduleNameMapping: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
      '^@blade-ai/(.+)$': '<rootDir>/packages/$1/src/index.ts',
      '^@/(.+)$': '<rootDir>/src/$1'
    },
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    globals: {
      'ts-jest': {
        useESM: true,
        isolatedModules: true
      }
    },
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      'packages/*/src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!packages/*/src/**/*.d.ts',
      '!src/**/index.ts',
      '!packages/*/src/**/index.ts',
      '!src/**/*.config.ts',
      '!packages/*/src/**/*.config.ts'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [
      'text',
      'lcov',
      'html',
      'teamcity'
    ],
    coverageThreshold: {
      global: {
        branches: isDevelopment ? 70 : 80,
        functions: isDevelopment ? 70 : 80,
        lines: isDevelopment ? 70 : 80,
        statements: isDevelopment ? 70 : 80
      },
      './packages/core/': {
        branches: isDevelopment ? 75 : 85,
        functions: isDevelopment ? 75 : 85,
        lines: isDevelopment ? 75 : 85,
        statements: isDevelopment ? 75 : 85
      },
      './packages/ui/': {
        branches: isDevelopment ? 65 : 75,
        functions: isDevelopment ? 65 : 75,
        lines: isDevelopment ? 65 : 75,
        statements: isDevelopment ? 65 : 75
      }
    },
    testTimeout: isDevelopment ? 15000 : 10000,
    maxWorkers: isDevelopment ? '25%' : '50%',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    resetMocks: false,
    restoreMocks: false,
    clearMocks: true,
    verbose: isDevelopment,
    errorOnDeprecated: isMain,
    forceExit: true,
    detectOpenHandles: true,
    testSequencer: '<rootDir>/tests/sequencer.js',
    // CI/CD 特定配置
    ...(process.env.CI === 'true' && {
      reporters: [
        'default',
        ['jest-junit', {
          outputDirectory: 'reports/jest',
          outputName: 'junit.xml',
          classNameTemplate: '{classname}',
          titleTemplate: '{title}',
          ancestorSeparator: ' › ',
          usePathForSuiteName: true
        }],
        ['github-actions', {
          silent: false
        }]
      ],
      collectCoverage: true,
      coverageReporters: [
        'text',
        'lcov',
        'clover',
        'teamcity'
      ]
    })
  };
}