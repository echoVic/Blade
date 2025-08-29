import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// 全局设置
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// 模拟 Node.js 的 fetch API
if (!global.fetch) {
  global.fetch = jest.fn();
}

// 设置一些全局的测试工具
global.describe = describe;
global.test = test;
global.it = test;
global.expect = expect;
global.beforeAll = beforeAll;
global.beforeEach = beforeEach;
global.afterAll = afterAll;
global.afterEach = afterEach;

// 模拟 console 方法，减少测试时的噪音
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = jest.fn((...args) => {
  if (process.env.DEBUG_TESTS === 'true') {
    originalConsoleLog(...args);
  }
});

console.warn = jest.fn((...args) => {
  if (process.env.DEBUG_TESTS === 'true') {
    originalConsoleWarn(...args);
  }
});

console.error = jest.fn((...args) => {
  if (process.env.DEBUG_TESTS === 'true') {
    originalConsoleError(...args);
  }
});

// 设置测试超时
jest.setTimeout(10000);

// 清理函数，在每个测试后执行
afterEach(() => {
  // 清理所有 mock
  jest.clearAllMocks();
  
  // 清理定时器
  jest.clearAllTimers();
  
  // 清理进程监听器
  process.removeAllListeners();
  
  // 重置 fetch mock
  if (global.fetch) {
    (global.fetch as jest.Mock).mockClear();
  }
});

// 设置错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// 模拟文件系统
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn()
}));

// 模拟路径模块
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop() || ''),
  extname: jest.fn((path) => {
    const lastDot = path.lastIndexOf('.');
    return lastDot === -1 ? '' : path.slice(lastDot);
  })
}));

// 模拟子进程
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  exec: jest.fn(),
  spawn: jest.fn(),
  fork: jest.fn()
}));

// 模拟网络请求
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    head: jest.fn(),
    options: jest.fn()
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  head: jest.fn(),
  options: jest.fn()
}));

// 模拟 WebSocket
jest.mock('ws', () => ({
  WebSocket: jest.fn(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
}));

// 模拟环境变量
process.env.NODE_ENV = 'test';
process.env.DEBUG_TESTS = 'false';

// 设置测试特定的环境变量
process.env.TEST_MODE = 'true';
process env.LOG_LEVEL = 'error';