{
  "preset": "ts-jest/presets/default-js-with-esm",
  "testEnvironment": "node",
  "roots": ["<rootDir>/src", "<rootDir>/packages/*/src"],
  "testMatch": [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx",
    "**/test/**/*.test.ts",
    "**/test/**/*.test.tsx"
  ],
  "moduleFileExtensions": ["ts", "tsx", "js", "jsx", "json", "node"],
  "transform": {
    "^.+\\.tsx?$": ["ts-jest", {
      "useESM": true,
      "tsconfig": {
        "jsx": "react-jsx"
      }
    }],
    "^.+\\.jsx?$": ["babel-jest", {
      "presets": ["@babel/preset-env", "@babel/preset-react"]
    }]
  },
  "moduleNameMapping": {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@blade-ai/(.+)$": "<rootDir>/packages/$1/src/index.ts",
    "^@/(.+)$": "<rootDir>/src/$1"
  },
  "extensionsToTreatAsEsm": [".ts", ".tsx"],
  "globals": {
    "ts-jest": {
      "useESM": true,
      "isolatedModules": true
    }
  },
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "packages/*/src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!packages/*/src/**/*.d.ts",
    "!src/**/index.ts",
    "!packages/*/src/index.ts",
    "!src/**/*.config.ts",
    "!packages/*/src/**/*.config.ts"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": [
    "text",
    "lcov",
    "html",
    "teamcity"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    },
    "./packages/core/": {
      "branches": 85,
      "functions": 85,
      "lines": 85,
      "statements": 85
    },
    "./packages/ui/": {
      "branches": 75,
      "functions": 75,
      "lines": 75,
      "statements": 75
    }
  },
  "testTimeout": 10000,
  "maxWorkers": "50%",
  "setupFilesAfterEnv": ["<rootDir>/tests/setup.ts"],
  "resetMocks": false,
  "restoreMocks": false,
  "clearMocks": true,
  "verbose": true,
  "errorOnDeprecated": true,
  "forceExit": true,
  "detectOpenHandles": true,
  "testSequencer": "<rootDir>/tests/sequencer.js"
}