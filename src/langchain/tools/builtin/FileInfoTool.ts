import { promises as fs } from 'fs';
import { basename, dirname, extname, resolve } from 'path';
import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import {
  RiskLevel,
  ToolCategory,
  type BladeToolConfig,
  type BladeToolResult,
  type ToolExecutionContext,
} from '../types.js';

/**
 * 文件信息工具
 * 获取文件或目录的详细信息，包括权限、时间戳等
 */
export class FileInfoTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'file_info',
      description: '获取文件或目录的详细信息，包括大小、权限、时间戳等',
      category: ToolCategory.FILESYSTEM,
      tags: ['file', 'info', 'stats', 'metadata', 'filesystem'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().min(1, '文件路径不能为空'),
      includeChecksum: z.boolean().default(false),
      checksumType: z.enum(['md5', 'sha1', 'sha256']).default('sha256'),
      followSymlinks: z.boolean().default(true),
    });
  }

  protected async executeInternal(
    params: {
      path: string;
      includeChecksum?: boolean;
      checksumType?: string;
      followSymlinks?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      path,
      includeChecksum = false,
      checksumType = 'sha256',
      followSymlinks = true,
    } = params;
    const startTime = Date.now();

    try {
      const resolvedPath = resolve(path);

      // 获取文件状态
      const stats = followSymlinks ? await fs.stat(resolvedPath) : await fs.lstat(resolvedPath);

      const fileName = basename(resolvedPath);
      const dirName = dirname(resolvedPath);
      const fileExtension = stats.isFile() ? extname(resolvedPath) : null;

      // 基本信息
      const basicInfo = {
        path: resolvedPath,
        name: fileName,
        directory: dirName,
        extension: fileExtension,
        type: this.getFileType(stats),
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
      };

      // 权限信息
      const permissions = {
        mode: stats.mode.toString(8),
        readable: !!(stats.mode & parseInt('444', 8)),
        writable: !!(stats.mode & parseInt('222', 8)),
        executable: !!(stats.mode & parseInt('111', 8)),
        uid: stats.uid,
        gid: stats.gid,
      };

      // 时间戳信息
      const timestamps = {
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        changed: stats.ctime.toISOString(),
        createdMs: stats.birthtime.getTime(),
        modifiedMs: stats.mtime.getTime(),
        accessedMs: stats.atime.getTime(),
        changedMs: stats.ctime.getTime(),
      };

      // 文件类型分析
      const typeAnalysis = {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymbolicLink: stats.isSymbolicLink(),
        isBlockDevice: stats.isBlockDevice(),
        isCharacterDevice: stats.isCharacterDevice(),
        isFIFO: stats.isFIFO(),
        isSocket: stats.isSocket(),
      };

      // 扩展信息
      let extendedInfo: any = {};

      if (stats.isFile()) {
        extendedInfo.mimeType = this.guessMimeType(fileExtension);
        extendedInfo.category = this.getFileCategory(fileExtension);

        if (includeChecksum && stats.size < 100 * 1024 * 1024) {
          // 限制100MB以下文件
          try {
            extendedInfo.checksum = await this.calculateChecksum(resolvedPath, checksumType);
          } catch (error) {
            extendedInfo.checksumError = '计算校验和时出错';
          }
        }
      }

      if (stats.isDirectory()) {
        try {
          const dirContents = await fs.readdir(resolvedPath);
          extendedInfo.itemCount = dirContents.length;
          extendedInfo.hasHiddenFiles = dirContents.some(name => name.startsWith('.'));
        } catch (error) {
          extendedInfo.accessError = '无法读取目录内容';
        }
      }

      if (stats.isSymbolicLink() && !followSymlinks) {
        try {
          extendedInfo.linkTarget = await fs.readlink(resolvedPath);
        } catch (error) {
          extendedInfo.linkError = '无法读取符号链接目标';
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          ...basicInfo,
          permissions,
          timestamps,
          typeAnalysis,
          extendedInfo,
          relativePath: this.getRelativePath(resolvedPath),
          humanReadable: this.getHumanReadableInfo(basicInfo, timestamps),
        },
        duration: executionTime,
        metadata: {
          operation: 'file_info',
          executionTime,
          executionId: context.executionId,
          analysisConfig: {
            includeChecksum,
            checksumType,
            followSymlinks,
          },
          fileAnalysis: {
            type: this.getFileType(stats),
            category: stats.isFile() ? this.getFileCategory(fileExtension) : 'directory',
            sizeCategory: this.getSizeCategory(stats.size),
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `获取文件信息失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'file_info',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          errorCode: error.code,
          analysisConfig: {
            path,
            includeChecksum,
            checksumType,
            followSymlinks,
          },
        },
      };
    }
  }

  /**
   * 获取文件类型
   */
  private getFileType(stats: any): string {
    if (stats.isFile()) return 'file';
    if (stats.isDirectory()) return 'directory';
    if (stats.isSymbolicLink()) return 'symlink';
    if (stats.isBlockDevice()) return 'block-device';
    if (stats.isCharacterDevice()) return 'char-device';
    if (stats.isFIFO()) return 'fifo';
    if (stats.isSocket()) return 'socket';
    return 'unknown';
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * 猜测MIME类型
   */
  private guessMimeType(extension: string | null): string {
    if (!extension) return 'application/octet-stream';

    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * 获取文件分类
   */
  private getFileCategory(extension: string | null): string {
    if (!extension) return 'unknown';

    const categories: Record<string, string> = {
      '.txt': 'text',
      '.md': 'text',
      '.doc': 'document',
      '.docx': 'document',
      '.pdf': 'document',
      '.html': 'code',
      '.css': 'code',
      '.js': 'code',
      '.ts': 'code',
      '.py': 'code',
      '.java': 'code',
      '.cpp': 'code',
      '.c': 'code',
      '.json': 'data',
      '.xml': 'data',
      '.csv': 'data',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.mp4': 'video',
      '.avi': 'video',
      '.mkv': 'video',
      '.mp3': 'audio',
      '.wav': 'audio',
      '.flac': 'audio',
      '.zip': 'archive',
      '.tar': 'archive',
      '.gz': 'archive',
      '.rar': 'archive',
    };

    return categories[extension.toLowerCase()] || 'unknown';
  }

  /**
   * 获取大小分类
   */
  private getSizeCategory(bytes: number): string {
    if (bytes === 0) return 'empty';
    if (bytes < 1024) return 'tiny';
    if (bytes < 1024 * 1024) return 'small';
    if (bytes < 10 * 1024 * 1024) return 'medium';
    if (bytes < 100 * 1024 * 1024) return 'large';
    if (bytes < 1024 * 1024 * 1024) return 'very-large';
    return 'huge';
  }

  /**
   * 计算校验和
   */
  private async calculateChecksum(filePath: string, type: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash(type);
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * 获取相对路径
   */
  private getRelativePath(absolutePath: string): string {
    const cwd = process.cwd();
    if (absolutePath.startsWith(cwd)) {
      return '.' + absolutePath.substring(cwd.length);
    }
    return absolutePath;
  }

  /**
   * 获取人类可读信息
   */
  private getHumanReadableInfo(basicInfo: any, timestamps: any): any {
    const now = Date.now();
    const modifiedMs = new Date(timestamps.modified).getTime();
    const ageMs = now - modifiedMs;

    return {
      ageDescription: this.getAgeDescription(ageMs),
      sizeDescription: this.getSizeDescription(basicInfo.size),
      typeDescription: this.getTypeDescription(basicInfo.type, basicInfo.extension),
    };
  }

  /**
   * 获取年龄描述
   */
  private getAgeDescription(ageMs: number): string {
    const minutes = Math.floor(ageMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} 年前`;
    if (months > 0) return `${months} 个月前`;
    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return '刚刚';
  }

  /**
   * 获取大小描述
   */
  private getSizeDescription(bytes: number): string {
    if (bytes === 0) return '空文件';
    if (bytes < 1024) return '很小';
    if (bytes < 1024 * 1024) return '小文件';
    if (bytes < 10 * 1024 * 1024) return '中等大小';
    if (bytes < 100 * 1024 * 1024) return '较大文件';
    return '大文件';
  }

  /**
   * 获取类型描述
   */
  private getTypeDescription(type: string, extension: string | null): string {
    if (type === 'directory') return '目录';
    if (type === 'symlink') return '符号链接';
    if (!extension) return '无扩展名文件';

    const descriptions: Record<string, string> = {
      '.txt': '文本文件',
      '.md': 'Markdown 文档',
      '.js': 'JavaScript 文件',
      '.ts': 'TypeScript 文件',
      '.py': 'Python 脚本',
      '.json': 'JSON 数据文件',
      '.png': 'PNG 图片',
      '.jpg': 'JPEG 图片',
      '.pdf': 'PDF 文档',
      '.zip': 'ZIP 压缩包',
    };

    return descriptions[extension.toLowerCase()] || `${extension.substring(1).toUpperCase()} 文件`;
  }
}
