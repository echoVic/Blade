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
 * 文本搜索工具
 * 在文本中搜索指定内容，支持正则表达式
 */
export class TextSearchTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'text_search',
      description: '在文本中搜索指定内容，支持正则表达式和多种搜索模式',
      category: ToolCategory.TEXT,
      tags: ['text', 'search', 'find', 'regex', 'pattern'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      text: z.string().min(1, '文本内容不能为空'),
      pattern: z.string().min(1, '搜索模式不能为空'),
      caseSensitive: z.boolean().default(false),
      useRegex: z.boolean().default(false),
      maxMatches: z.number().positive().max(1000).default(100),
      includeContext: z.boolean().default(false),
      contextLength: z.number().positive().max(200).default(50),
    });
  }

  protected async executeInternal(
    params: {
      text: string;
      pattern: string;
      caseSensitive?: boolean;
      useRegex?: boolean;
      maxMatches?: number;
      includeContext?: boolean;
      contextLength?: number;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      text,
      pattern,
      caseSensitive = false,
      useRegex = false,
      maxMatches = 100,
      includeContext = false,
      contextLength = 50,
    } = params;
    const startTime = Date.now();

    try {
      let matches: Array<{
        text: string;
        index: number;
        length: number;
        line: number;
        column: number;
        context?: {
          before: string;
          after: string;
        };
      }> = [];

      if (useRegex) {
        matches = this.performRegexSearch(
          text,
          pattern,
          caseSensitive,
          maxMatches,
          includeContext,
          contextLength
        );
      } else {
        matches = this.performTextSearch(
          text,
          pattern,
          caseSensitive,
          maxMatches,
          includeContext,
          contextLength
        );
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          pattern,
          searchType: useRegex ? 'regex' : 'text',
          caseSensitive,
          matches,
          totalMatches: matches.length,
          hasMoreMatches: matches.length >= maxMatches,
          statistics: {
            textLength: text.length,
            patternLength: pattern.length,
            matchDensity:
              text.length > 0 ? ((matches.length / text.length) * 100).toFixed(2) + '%' : '0%',
          },
        },
        duration: executionTime,
        metadata: {
          operation: 'text_search',
          executionTime,
          executionId: context.executionId,
          searchConfig: {
            useRegex,
            caseSensitive,
            maxMatches,
            includeContext,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `文本搜索失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'text_search',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          searchConfig: {
            pattern,
            useRegex,
            caseSensitive,
          },
        },
      };
    }
  }

  /**
   * 执行正则表达式搜索
   */
  private performRegexSearch(
    text: string,
    pattern: string,
    caseSensitive: boolean,
    maxMatches: number,
    includeContext: boolean,
    contextLength: number
  ): Array<any> {
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    const matches: Array<any> = [];
    let match;
    let count = 0;

    while ((match = regex.exec(text)) !== null && count < maxMatches) {
      const matchInfo: any = {
        text: match[0],
        index: match.index!,
        length: match[0].length,
        ...this.getLineAndColumn(text, match.index!),
      };

      if (includeContext) {
        matchInfo.context = this.getContext(text, match.index!, match[0].length, contextLength);
      }

      matches.push(matchInfo);
      count++;

      // 防止无限循环（零宽度匹配）
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * 执行文本搜索
   */
  private performTextSearch(
    text: string,
    pattern: string,
    caseSensitive: boolean,
    maxMatches: number,
    includeContext: boolean,
    contextLength: number
  ): Array<any> {
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();
    const matches: Array<any> = [];

    let index = 0;
    let count = 0;

    while (index < searchText.length && count < maxMatches) {
      const found = searchText.indexOf(searchPattern, index);
      if (found === -1) break;

      const matchInfo: any = {
        text: text.substring(found, found + pattern.length),
        index: found,
        length: pattern.length,
        ...this.getLineAndColumn(text, found),
      };

      if (includeContext) {
        matchInfo.context = this.getContext(text, found, pattern.length, contextLength);
      }

      matches.push(matchInfo);
      index = found + 1;
      count++;
    }

    return matches;
  }

  /**
   * 获取匹配位置的行号和列号
   */
  private getLineAndColumn(text: string, index: number): { line: number; column: number } {
    const lines = text.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * 获取匹配文本的上下文
   */
  private getContext(
    text: string,
    index: number,
    length: number,
    contextLength: number
  ): { before: string; after: string } {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + length + contextLength);

    return {
      before: text.substring(start, index),
      after: text.substring(index + length, end),
    };
  }
}
