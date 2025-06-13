import { promises as fs } from 'fs';
import { basename, extname, join, resolve } from 'path';
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
 * 目录列表工具
 * 列出目录中的文件和子目录，支持递归和过滤
 */
export class DirectoryListTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'directory_list',
      description: '列出目录中的文件和子目录，支持递归遍历和文件类型过滤',
      category: ToolCategory.FILESYSTEM,
      tags: ['directory', 'list', 'files', 'filesystem', 'recursive'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      path: z.string().default('.'),
      recursive: z.boolean().default(false),
      includeHidden: z.boolean().default(false),
      maxDepth: z.number().positive().max(10).default(5),
      fileTypes: z.array(z.string()).optional(),
      sortBy: z.enum(['name', 'size', 'modified', 'type']).default('name'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
      includeDetails: z.boolean().default(true),
    });
  }

  protected async executeInternal(
    params: {
      path?: string;
      recursive?: boolean;
      includeHidden?: boolean;
      maxDepth?: number;
      fileTypes?: string[];
      sortBy?: string;
      sortOrder?: string;
      includeDetails?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      path = '.',
      recursive = false,
      includeHidden = false,
      maxDepth = 5,
      fileTypes,
      sortBy = 'name',
      sortOrder = 'asc',
      includeDetails = true,
    } = params;
    const startTime = Date.now();

    try {
      const resolvedPath = resolve(path);

      // 检查路径是否存在且为目录
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `指定路径不是目录: ${resolvedPath}`,
          metadata: {
            path: resolvedPath,
            type: stats.isFile() ? 'file' : 'unknown',
            executionTime: Date.now() - startTime,
            executionId: context.executionId,
          },
        };
      }

      const files: any[] = [];
      const processedPaths = new Set<string>();

      // 递归列出文件
      const listDirectory = async (dirPath: string, depth = 0): Promise<void> => {
        if (depth > maxDepth || processedPaths.has(dirPath)) {
          return;
        }
        processedPaths.add(dirPath);

        try {
          const items = await fs.readdir(dirPath);

          for (const item of items) {
            // 跳过隐藏文件
            if (!includeHidden && item.startsWith('.')) {
              continue;
            }

            const itemPath = join(dirPath, item);
            let itemStats;

            try {
              itemStats = await fs.stat(itemPath);
            } catch (error) {
              // 跳过无法访问的文件（如权限问题或损坏的符号链接）
              continue;
            }

            const relativePath = itemPath.replace(resolvedPath, '').replace(/^[/\\]/, '');
            const isDirectory = itemStats.isDirectory();
            const isFile = itemStats.isFile();

            // 文件类型过滤
            if (fileTypes && fileTypes.length > 0 && isFile) {
              const ext = extname(item).toLowerCase();
              if (!fileTypes.includes(ext) && !fileTypes.includes(ext.substring(1))) {
                continue;
              }
            }

            const fileInfo: any = {
              name: item,
              path: itemPath,
              relativePath: relativePath || item,
              type: isDirectory ? 'directory' : isFile ? 'file' : 'other',
              depth,
            };

            if (includeDetails) {
              fileInfo.size = itemStats.size;
              fileInfo.sizeFormatted = this.formatFileSize(itemStats.size);
              fileInfo.modified = itemStats.mtime.toISOString();
              fileInfo.created = itemStats.birthtime.toISOString();
              fileInfo.permissions = {
                readable: true, // 简化处理
                writable: true,
                executable: isFile && (itemStats.mode & parseInt('111', 8)) !== 0,
              };

              if (isFile) {
                fileInfo.extension = extname(item).toLowerCase();
                fileInfo.baseName = basename(item, fileInfo.extension);
              }
            }

            files.push(fileInfo);

            // 递归处理子目录
            if (recursive && isDirectory && depth < maxDepth) {
              await listDirectory(itemPath, depth + 1);
            }
          }
        } catch (error) {
          // 记录目录访问错误但继续处理
          console.warn(`无法访问目录 ${dirPath}:`, error);
        }
      };

      await listDirectory(resolvedPath);

      // 排序文件列表
      this.sortFiles(files, sortBy, sortOrder);

      // 生成统计信息
      const statistics = this.generateStatistics(files, recursive, maxDepth);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          path: resolvedPath,
          files,
          statistics,
          options: {
            recursive,
            includeHidden,
            maxDepth,
            fileTypes,
            sortBy,
            sortOrder,
            includeDetails,
          },
        },
        duration: executionTime,
        metadata: {
          operation: 'directory_list',
          executionTime,
          executionId: context.executionId,
          listConfig: {
            recursive,
            includeHidden,
            maxDepth,
            fileTypesFilter: fileTypes?.length || 0,
          },
          performance: {
            filesFound: files.length,
            directoriesScanned: processedPaths.size,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `目录列表失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'directory_list',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          errorCode: error.code,
          listConfig: {
            path,
            recursive,
            includeHidden,
            maxDepth,
          },
        },
      };
    }
  }

  /**
   * 排序文件列表
   */
  private sortFiles(files: any[], sortBy: string, sortOrder: string): void {
    files.sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'name':
          compareValue = a.name.localeCompare(b.name);
          break;
        case 'size':
          compareValue = (a.size || 0) - (b.size || 0);
          break;
        case 'modified':
          compareValue = new Date(a.modified || 0).getTime() - new Date(b.modified || 0).getTime();
          break;
        case 'type':
          compareValue = a.type.localeCompare(b.type);
          break;
        default:
          compareValue = a.name.localeCompare(b.name);
      }

      return sortOrder === 'desc' ? -compareValue : compareValue;
    });
  }

  /**
   * 生成统计信息
   */
  private generateStatistics(files: any[], recursive: boolean, maxDepth: number): any {
    const filesByType = files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {});

    const filesByDepth = files.reduce((acc, file) => {
      acc[file.depth] = (acc[file.depth] || 0) + 1;
      return acc;
    }, {});

    const totalSize = files
      .filter(f => f.type === 'file')
      .reduce((sum, f) => sum + (f.size || 0), 0);

    const extensions = files
      .filter(f => f.type === 'file' && f.extension)
      .reduce((acc, f) => {
        acc[f.extension] = (acc[f.extension] || 0) + 1;
        return acc;
      }, {});

    return {
      total: files.length,
      byType: filesByType,
      byDepth: recursive ? filesByDepth : undefined,
      totalSize,
      totalSizeFormatted: this.formatFileSize(totalSize),
      extensions: Object.keys(extensions).length > 0 ? extensions : undefined,
      maxDepthReached: recursive ? Math.max(...files.map(f => f.depth), 0) : 0,
      settings: {
        recursive,
        maxDepth,
      },
    };
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
