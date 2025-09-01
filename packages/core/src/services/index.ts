// 核心服务导出

export { FileSystemService } from './fileSystemService.js';
export { GitService } from './gitService.js';
export { ChatRecordingService } from './chatRecordingService.js';

// 类型定义
export type { 
  ReadFileOptions, 
  WriteFileOptions, 
  FileInfo, 
  SearchOptions, 
  SearchResult 
} from './fileSystemService.js';

export type { 
  GitResult, 
  GitStatus, 
  GitCommit, 
  GitBranchInfo 
} from './gitService.js';

export type { 
  ChatRecording, 
  ChatMessage, 
  ChatRecordingInfo 
} from './chatRecordingService.js';