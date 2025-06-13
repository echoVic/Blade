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
 * 文本替换工具
 * 支持普通文本和正则表达式的查找替换功能
 */
export class TextReplaceTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'text_replace',
      description: '进行文本查找和替换操作，支持正则表达式和批量替换',
      category: ToolCategory.TEXT,
      tags: ['text', 'replace', 'regex', 'search', 'processing'],
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
      search: z.string().min(1, '搜索模式不能为空'),
      replace: z.string().default(''),
      useRegex: z.boolean().default(false),
      flags: z.string().default('g'),
      maxReplacements: z.number().positive().max(10000).optional(),
      caseSensitive: z.boolean().default(true),
      wholeWord: z.boolean().default(false),
      preserveCase: z.boolean().default(false),
    });
  }

  protected async executeInternal(
    params: {
      text: string;
      search: string;
      replace?: string;
      useRegex?: boolean;
      flags?: string;
      maxReplacements?: number;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      preserveCase?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      text,
      search,
      replace = '',
      useRegex = false,
      flags = 'g',
      maxReplacements,
      caseSensitive = true,
      wholeWord = false,
      preserveCase = false,
    } = params;
    const startTime = Date.now();

    try {
      let pattern: RegExp;
      let replacementCount = 0;
      let replacements: Array<{
        original: string;
        replacement: string;
        position: number;
        lineNumber: number;
        columnNumber: number;
      }> = [];

      // 构建搜索模式
      if (useRegex) {
        try {
          pattern = new RegExp(search, flags);
        } catch (error: any) {
          return {
            success: false,
            error: `正则表达式语法错误: ${error.message}`,
            metadata: {
              operation: 'text_replace',
              searchPattern: search,
              executionTime: Date.now() - startTime,
            },
          };
        }
      } else {
        // 普通文本搜索
        let searchPattern = this.escapeRegExp(search);

        if (wholeWord) {
          searchPattern = `\\b${searchPattern}\\b`;
        }

        let regexFlags = flags;
        if (!caseSensitive && !regexFlags.includes('i')) {
          regexFlags += 'i';
        }

        pattern = new RegExp(searchPattern, regexFlags);
      }

      // 执行替换
      let result: string;
      let currentText = text;

      if (maxReplacements) {
        // 限制替换次数
        result = this.replaceWithLimit(
          currentText,
          pattern,
          replace,
          maxReplacements,
          preserveCase,
          replacements
        );
        replacementCount = replacements.length;
      } else {
        // 全部替换
        if (preserveCase && !useRegex) {
          result = this.replaceWithCasePreservation(currentText, pattern, replace, replacements);
        } else {
          result = currentText.replace(pattern, (match, ...args) => {
            const offset = args[args.length - 2];
            const position = this.getPositionInfo(text, offset);

            replacements.push({
              original: match,
              replacement: replace,
              position: offset,
              lineNumber: position.line,
              columnNumber: position.column,
            });

            return replace;
          });
        }
        replacementCount = replacements.length;
      }

      const executionTime = Date.now() - startTime;

      // 计算统计信息
      const statistics = this.calculateStatistics(text, result, replacements);

      return {
        success: true,
        data: {
          originalText: text.length > 500 ? text.substring(0, 500) + '... (截断)' : text,
          result: result.length > 2000 ? result.substring(0, 2000) + '... (截断)' : result,
          fullResult: result,
          searchPattern: search,
          replacementText: replace,
          replacementCount,
          replacements: replacements.slice(0, 100), // 限制替换详情数量
          statistics,
          configuration: {
            useRegex,
            flags,
            caseSensitive,
            wholeWord,
            preserveCase,
            maxReplacements: maxReplacements || null,
          },
        },
        duration: executionTime,
        metadata: {
          operation: 'text_replace',
          executionTime,
          executionId: context.executionId,
          replaceConfig: {
            searchType: useRegex ? 'regex' : 'text',
            flags,
            caseSensitive,
            wholeWord,
            preserveCase,
            hasLimit: !!maxReplacements,
          },
          performance: {
            charactersProcessed: text.length,
            replacementsMade: replacementCount,
            processingRate: Math.round((text.length / executionTime) * 1000), // chars per second
            efficiencyScore: this.calculateEfficiencyScore(
              text.length,
              replacementCount,
              executionTime
            ),
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `文本替换失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'text_replace',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          replaceConfig: {
            searchPattern: search,
            useRegex,
            flags,
          },
        },
      };
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 限制替换次数的替换
   */
  private replaceWithLimit(
    text: string,
    pattern: RegExp,
    replacement: string,
    maxReplacements: number,
    preserveCase: boolean,
    replacements: any[]
  ): string {
    let result = text;
    let count = 0;
    let match;

    // 重置正则表达式的 lastIndex
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) && count < maxReplacements) {
      const offset = match.index;
      const position = this.getPositionInfo(text, offset);

      let actualReplacement = replacement;
      if (preserveCase && !pattern.flags.includes('g')) {
        actualReplacement = this.preserveCase(match[0], replacement);
      }

      replacements.push({
        original: match[0],
        replacement: actualReplacement,
        position: offset,
        lineNumber: position.line,
        columnNumber: position.column,
      });

      result =
        result.substring(0, offset) +
        actualReplacement +
        result.substring(offset + match[0].length);
      count++;

      // 调整后续匹配的索引
      const lengthDiff = actualReplacement.length - match[0].length;
      pattern.lastIndex += lengthDiff;
    }

    return result;
  }

  /**
   * 保持大小写的替换
   */
  private replaceWithCasePreservation(
    text: string,
    pattern: RegExp,
    replacement: string,
    replacements: any[]
  ): string {
    return text.replace(pattern, (match, ...args) => {
      const offset = args[args.length - 2];
      const position = this.getPositionInfo(text, offset);
      const preservedReplacement = this.preserveCase(match, replacement);

      replacements.push({
        original: match,
        replacement: preservedReplacement,
        position: offset,
        lineNumber: position.line,
        columnNumber: position.column,
      });

      return preservedReplacement;
    });
  }

  /**
   * 保持原文本的大小写模式
   */
  private preserveCase(original: string, replacement: string): string {
    if (original.length === 0) return replacement;

    // 检测大小写模式
    const isAllUpper = original === original.toUpperCase();
    const isAllLower = original === original.toLowerCase();
    const isCapitalized =
      original[0] === original[0].toUpperCase() &&
      original.slice(1) === original.slice(1).toLowerCase();

    if (isAllUpper) {
      return replacement.toUpperCase();
    } else if (isAllLower) {
      return replacement.toLowerCase();
    } else if (isCapitalized) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }

    return replacement;
  }

  /**
   * 获取位置信息（行号和列号）
   */
  private getPositionInfo(text: string, offset: number): { line: number; column: number } {
    const lines = text.substring(0, offset).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(originalText: string, resultText: string, replacements: any[]): any {
    const originalLength = originalText.length;
    const resultLength = resultText.length;
    const lengthDiff = resultLength - originalLength;

    const linesBefore = originalText.split('\n').length;
    const linesAfter = resultText.split('\n').length;
    const linesDiff = linesAfter - linesBefore;

    // 分析替换位置分布
    const lineDistribution: Record<number, number> = {};
    replacements.forEach(replacement => {
      lineDistribution[replacement.lineNumber] =
        (lineDistribution[replacement.lineNumber] || 0) + 1;
    });

    return {
      textLength: {
        before: originalLength,
        after: resultLength,
        difference: lengthDiff,
        changePercentage: originalLength > 0 ? Math.round((lengthDiff / originalLength) * 100) : 0,
      },
      lines: {
        before: linesBefore,
        after: linesAfter,
        difference: linesDiff,
      },
      replacements: {
        total: replacements.length,
        averageLength:
          replacements.length > 0
            ? Math.round(
                replacements.reduce((sum, r) => sum + r.original.length, 0) / replacements.length
              )
            : 0,
        lineDistribution,
        mostAffectedLine: this.getMostAffectedLine(lineDistribution),
      },
    };
  }

  /**
   * 获取受影响最多的行
   */
  private getMostAffectedLine(
    distribution: Record<number, number>
  ): { line: number; count: number } | null {
    let maxLine = 0;
    let maxCount = 0;

    for (const [line, count] of Object.entries(distribution)) {
      const lineNum = parseInt(line);
      if (count > maxCount) {
        maxCount = count;
        maxLine = lineNum;
      }
    }

    return maxCount > 0 ? { line: maxLine, count: maxCount } : null;
  }

  /**
   * 计算效率分数
   */
  private calculateEfficiencyScore(
    textLength: number,
    replacements: number,
    executionTime: number
  ): number {
    if (executionTime === 0) return 100;

    // 基于处理速度和替换密度的效率分数
    const processingRate = textLength / executionTime;
    const replacementDensity = replacements / textLength;

    // 标准化到 0-100 分数
    const speedScore = Math.min(100, processingRate * 10);
    const densityScore = Math.min(100, replacementDensity * 1000);

    return Math.round((speedScore + densityScore) / 2);
  }
}
