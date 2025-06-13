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
 * JSON 格式化工具
 * 支持JSON格式化、压缩、验证和分析
 */
export class JsonFormatTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'json_format',
      description: 'JSON格式化、压缩、验证和分析工具',
      category: ToolCategory.TEXT,
      tags: ['json', 'format', 'parse', 'validate', 'minify'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      input: z.string().min(1, 'JSON字符串不能为空'),
      operation: z.enum(['format', 'minify', 'validate', 'analyze']).default('format'),
      indent: z.number().min(0).max(10).default(2),
      sortKeys: z.boolean().default(false),
      removeComments: z.boolean().default(false),
      strictMode: z.boolean().default(true),
    });
  }

  protected async executeInternal(
    params: {
      input: string;
      operation?: string;
      indent?: number;
      sortKeys?: boolean;
      removeComments?: boolean;
      strictMode?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      input,
      operation = 'format',
      indent = 2,
      sortKeys = false,
      removeComments = false,
      strictMode = true,
    } = params;
    const startTime = Date.now();

    try {
      // 预处理输入
      let processedInput = input.trim();

      if (removeComments) {
        processedInput = this.removeJSONComments(processedInput);
      }

      // 解析JSON
      let parsed: any;
      try {
        parsed = JSON.parse(processedInput);
      } catch (parseError: any) {
        if (strictMode) {
          throw parseError;
        }
        // 尝试修复常见的JSON错误
        const fixed = this.attemptJSONFix(processedInput);
        parsed = JSON.parse(fixed);
      }

      // 执行操作
      let result: any = {};

      switch (operation) {
        case 'format':
          result = this.formatJSON(parsed, indent, sortKeys);
          break;
        case 'minify':
          result = this.minifyJSON(parsed, sortKeys);
          break;
        case 'validate':
          result = this.validateJSON(parsed, processedInput);
          break;
        case 'analyze':
          result = this.analyzeJSON(parsed, processedInput);
          break;
        default:
          throw new Error(`不支持的操作: ${operation}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: result,
        duration: executionTime,
        metadata: {
          operation: 'json_format',
          executionTime,
          executionId: context.executionId,
          operationType: operation,
          inputSize: input.length,
          outputSize: result.output?.length || 0,
          processingConfig: {
            indent,
            sortKeys,
            removeComments,
            strictMode,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `JSON${operation}失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'json_format',
          executionTime,
          executionId: context.executionId,
          operationType: operation,
          errorType: error.constructor.name,
          errorPosition: this.findErrorPosition(input, error.message),
          inputPreview: input.substring(0, 100),
          processingConfig: {
            indent,
            sortKeys,
            removeComments,
            strictMode,
          },
        },
      };
    }
  }

  /**
   * 格式化JSON
   */
  private formatJSON(parsed: any, indent: number, sortKeys: boolean): any {
    const replacer = sortKeys ? this.createSortingReplacer() : undefined;
    const formatted = JSON.stringify(parsed, replacer, indent);

    return {
      output: formatted,
      originalSize: JSON.stringify(parsed).length,
      formattedSize: formatted.length,
      compressionRatio: this.calculateCompressionRatio(JSON.stringify(parsed), formatted),
      lineCount: formatted.split('\n').length,
      indentStyle: `${indent} spaces`,
      keySorted: sortKeys,
    };
  }

  /**
   * 压缩JSON
   */
  private minifyJSON(parsed: any, sortKeys: boolean): any {
    const replacer = sortKeys ? this.createSortingReplacer() : undefined;
    const minified = JSON.stringify(parsed, replacer);
    const original = JSON.stringify(parsed, null, 2);

    return {
      output: minified,
      originalSize: original.length,
      minifiedSize: minified.length,
      savedBytes: original.length - minified.length,
      compressionRatio: this.calculateCompressionRatio(original, minified),
      keySorted: sortKeys,
    };
  }

  /**
   * 验证JSON
   */
  private validateJSON(parsed: any, input: string): any {
    const analysis = this.analyzeJSONStructure(parsed);

    return {
      isValid: true,
      message: '✓ 有效的JSON',
      structure: analysis.structure,
      stats: analysis.stats,
      recommendations: this.generateJSONRecommendations(analysis),
      inputSize: input.length,
      minifiedSize: JSON.stringify(parsed).length,
    };
  }

  /**
   * 分析JSON
   */
  private analyzeJSON(parsed: any, input: string): any {
    const analysis = this.analyzeJSONStructure(parsed);
    const security = this.analyzeJSONSecurity(parsed);
    const performance = this.analyzeJSONPerformance(parsed, input);

    return {
      structure: analysis.structure,
      stats: analysis.stats,
      security,
      performance,
      recommendations: [
        ...this.generateJSONRecommendations(analysis),
        ...this.generateSecurityRecommendations(security),
        ...this.generatePerformanceRecommendations(performance),
      ],
      schema: this.generateJSONSchema(parsed),
    };
  }

  /**
   * 分析JSON结构
   */
  private analyzeJSONStructure(obj: any, path: string = '$'): any {
    const stats = {
      totalKeys: 0,
      totalValues: 0,
      maxDepth: 0,
      arrayCount: 0,
      objectCount: 0,
      primitiveCount: 0,
      nullCount: 0,
      types: new Set<string>(),
    };

    const structure: any = {};

    const analyze = (value: any, currentPath: string, depth: number = 0): any => {
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      stats.totalValues++;

      if (value === null) {
        stats.nullCount++;
        stats.types.add('null');
        return { type: 'null', path: currentPath };
      }

      const type = Array.isArray(value) ? 'array' : typeof value;
      stats.types.add(type);

      if (type === 'object') {
        stats.objectCount++;
        const objStructure: any = { type: 'object', properties: {}, path: currentPath };

        for (const [key, val] of Object.entries(value)) {
          stats.totalKeys++;
          const keyPath = `${currentPath}.${key}`;
          objStructure.properties[key] = analyze(val, keyPath, depth + 1);
        }

        return objStructure;
      } else if (type === 'array') {
        stats.arrayCount++;
        const arrayStructure: any = {
          type: 'array',
          length: value.length,
          path: currentPath,
          items: [],
        };

        // 分析数组前几个元素的结构
        const sampleSize = Math.min(3, value.length);
        for (let i = 0; i < sampleSize; i++) {
          const itemPath = `${currentPath}[${i}]`;
          arrayStructure.items.push(analyze(value[i], itemPath, depth + 1));
        }

        return arrayStructure;
      } else {
        stats.primitiveCount++;
        return {
          type,
          value:
            type === 'string'
              ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`
              : value,
          path: currentPath,
        };
      }
    };

    structure.root = analyze(obj, path);

    return {
      structure,
      stats: {
        ...stats,
        types: Array.from(stats.types),
        complexity: this.calculateJSONComplexity(stats),
      },
    };
  }

  /**
   * 分析JSON安全性
   */
  private analyzeJSONSecurity(obj: any): any {
    const issues: string[] = [];
    const warnings: string[] = [];

    const analyze = (value: any, path: string = '$'): void => {
      if (typeof value === 'string') {
        // 检查潜在的代码注入
        if (value.includes('<script>') || value.includes('javascript:')) {
          issues.push(`可能的XSS攻击向量在 ${path}`);
        }

        // 检查SQL注入模式
        if (/(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b)/i.test(value)) {
          warnings.push(`可疑的SQL模式在 ${path}`);
        }

        // 检查过长字符串
        if (value.length > 10000) {
          warnings.push(`超长字符串在 ${path} (${value.length} 字符)`);
        }
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => analyze(item, `${path}[${index}]`));
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, val]) => {
          // 检查敏感键名
          if (/password|secret|token|key|credential/i.test(key)) {
            warnings.push(`敏感键名 "${key}" 在 ${path}`);
          }
          analyze(val, `${path}.${key}`);
        });
      }
    };

    analyze(obj);

    return {
      riskLevel: issues.length > 0 ? 'HIGH' : warnings.length > 0 ? 'MEDIUM' : 'LOW',
      issues,
      warnings,
      hasSensitiveData: warnings.some(w => w.includes('敏感键名')),
    };
  }

  /**
   * 分析JSON性能
   */
  private analyzeJSONPerformance(obj: any, input: string): any {
    const stringifyTime = this.measureTime(() => JSON.stringify(obj));
    const parseTime = this.measureTime(() => JSON.parse(input));

    return {
      parseTime,
      stringifyTime,
      inputSize: input.length,
      minifiedSize: JSON.stringify(obj).length,
      prettySize: JSON.stringify(obj, null, 2).length,
      memoryFootprint: this.estimateMemoryUsage(obj),
      recommendations: this.getPerformanceRecommendations(obj, input),
    };
  }

  /**
   * 移除JSON注释
   */
  private removeJSONComments(input: string): string {
    // 移除单行注释 //
    let result = input.replace(/\/\/.*$/gm, '');
    // 移除多行注释 /* */
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
  }

  /**
   * 尝试修复JSON
   */
  private attemptJSONFix(input: string): string {
    let fixed = input;

    // 修复尾随逗号
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // 修复单引号
    fixed = fixed.replace(/'/g, '"');

    // 修复未引用的键
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

    return fixed;
  }

  /**
   * 创建排序替换器
   */
  private createSortingReplacer(): (key: string, value: any) => any {
    return (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const sorted: any = {};
        Object.keys(value)
          .sort()
          .forEach(k => {
            sorted[k] = value[k];
          });
        return sorted;
      }
      return value;
    };
  }

  /**
   * 计算压缩比
   */
  private calculateCompressionRatio(original: string, compressed: string): number {
    if (original.length === 0) return 0;
    return Number(((1 - compressed.length / original.length) * 100).toFixed(2));
  }

  /**
   * 计算JSON复杂度
   */
  private calculateJSONComplexity(stats: any): number {
    return stats.maxDepth * 10 + stats.objectCount * 5 + stats.arrayCount * 3 + stats.totalKeys * 2;
  }

  /**
   * 查找错误位置
   */
  private findErrorPosition(input: string, errorMessage: string): any {
    const match = errorMessage.match(/position (\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      const lines = input.substring(0, position).split('\n');
      return {
        position,
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
      };
    }
    return null;
  }

  /**
   * 测量执行时间
   */
  private measureTime(fn: () => void): number {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // 转换为毫秒
  }

  /**
   * 估算内存使用
   */
  private estimateMemoryUsage(obj: any): number {
    return JSON.stringify(obj).length * 2; // 粗略估算
  }

  /**
   * 生成JSON架构
   */
  private generateJSONSchema(obj: any): any {
    const getType = (value: any): string => {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    };

    const generateSchema = (value: any): any => {
      const type = getType(value);

      if (type === 'object') {
        const properties: any = {};
        Object.entries(value).forEach(([key, val]) => {
          properties[key] = generateSchema(val);
        });
        return { type: 'object', properties };
      } else if (type === 'array') {
        const items = value.length > 0 ? generateSchema(value[0]) : { type: 'string' };
        return { type: 'array', items };
      } else {
        return { type };
      }
    };

    return generateSchema(obj);
  }

  /**
   * 生成JSON建议
   */
  private generateJSONRecommendations(analysis: any): string[] {
    const recommendations: string[] = [];
    const { stats } = analysis;

    if (stats.maxDepth > 10) {
      recommendations.push('JSON嵌套层级过深，考虑扁平化结构');
    }

    if (stats.totalKeys > 1000) {
      recommendations.push('JSON包含大量键值对，考虑分页或分片');
    }

    if (stats.complexity > 500) {
      recommendations.push('JSON结构复杂，考虑简化设计');
    }

    return recommendations;
  }

  /**
   * 生成安全建议
   */
  private generateSecurityRecommendations(security: any): string[] {
    const recommendations: string[] = [];

    if (security.hasSensitiveData) {
      recommendations.push('检测到敏感数据，确保适当的访问控制');
    }

    if (security.issues.length > 0) {
      recommendations.push('发现安全问题，请检查和清理数据');
    }

    return recommendations;
  }

  /**
   * 生成性能建议
   */
  private generatePerformanceRecommendations(performance: any): string[] {
    const recommendations: string[] = [];

    if (performance.inputSize > 1024 * 1024) {
      // 1MB
      recommendations.push('JSON文件较大，考虑使用流式处理');
    }

    if (performance.parseTime > 100) {
      recommendations.push('JSON解析时间较长，考虑优化结构');
    }

    return recommendations;
  }

  /**
   * 获取性能建议
   */
  private getPerformanceRecommendations(obj: any, input: string): string[] {
    const recommendations: string[] = [];

    if (input.length > 1024 * 1024) {
      recommendations.push('考虑将大型JSON分割为较小的块');
    }

    return recommendations;
  }
}
