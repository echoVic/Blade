import type { ToolDefinition } from '../types.js';
import {
  gitAdd,
  gitBranch,
  gitCommit,
  gitDiff,
  gitLog,
  gitSmartCommit,
  gitStatus,
} from './git/index.js';

/**
 * Git 工具集合
 * 提供完整的Git操作功能
 */
export const gitTools: ToolDefinition[] = [
  gitStatus,
  gitLog,
  gitDiff,
  gitBranch,
  gitAdd,
  gitCommit,
  gitSmartCommit,
];
