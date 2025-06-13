/**
 * HTTP 请求工具 - LangChain 原生实现
 */

import { z } from 'zod';
import { BladeTool } from '../base/BladeTool.js';
import type { BladeToolResult, ToolExecutionContext } from '../types.js';

/**
 * HTTP 请求工具
 *
 * 提供完整的 HTTP 请求功能：
 * - 支持 GET, POST, PUT, DELETE 等方法
 * - 请求头和查询参数设置
 * - 响应处理和错误管理
 * - 超时控制
 */
export class HttpRequestTool extends BladeTool {
  constructor() {
    super({
      name: 'http_request',
      description: 'HTTP 请求工具，支持各种 HTTP 方法和参数',
      category: 'network',
      tags: ['http', 'request', 'api', 'network'],
      version: '2.0.0',
      riskLevel: 'moderate',
      requiresConfirmation: false,
    });
  }

  /**
   * 参数验证模式
   */
  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      url: z.string().url('Invalid URL format').describe('请求 URL'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
        .default('GET')
        .describe('HTTP 方法'),
      headers: z.record(z.string()).optional().describe('请求头'),
      params: z.record(z.any()).optional().describe('查询参数'),
      body: z.any().optional().describe('请求体'),
      timeout: z.number().min(1000).max(60000).default(10000).describe('超时时间（毫秒）'),
      followRedirects: z.boolean().default(true).describe('是否跟随重定向'),
    });
  }

  /**
   * 执行 HTTP 请求
   */
  protected async executeInternal(
    params: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      url,
      method,
      headers = {},
      params: queryParams,
      body,
      timeout,
      followRedirects,
    } = params;

    try {
      // 构建完整 URL（包含查询参数）
      const fullUrl = this.buildUrl(url, queryParams);

      // 准备请求配置
      const requestInit: RequestInit = {
        method,
        headers: {
          'User-Agent': 'Blade-AI/2.0.0',
          ...headers,
        },
        redirect: followRedirects ? 'follow' : 'manual',
      };

      // 添加请求体（如果需要）
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        if (typeof body === 'object') {
          requestInit.body = JSON.stringify(body);
          if (!headers['Content-Type']) {
            (requestInit.headers as Record<string, string>)['Content-Type'] = 'application/json';
          }
        } else {
          requestInit.body = String(body);
        }
      }

      // 执行请求（带超时）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(fullUrl, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 解析响应
        const responseData = await this.parseResponse(response);

        return {
          success: true,
          data: {
            url: fullUrl,
            method,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData,
            redirected: response.redirected,
            finalUrl: response.url,
          },
          metadata: {
            executionId: context.executionId,
            toolName: this.name,
            category: this.category,
            operation: 'http_request',
            performance: {
              method,
              status: response.status,
              redirected: response.redirected,
            },
          },
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 处理特定错误类型
      let errorType = 'unknown';
      if (errorMessage.includes('AbortError') || errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorType = 'network';
      } else if (errorMessage.includes('URL')) {
        errorType = 'invalid_url';
      }

      return {
        success: false,
        error: `HTTP 请求失败: ${errorMessage}`,
        metadata: {
          executionId: context.executionId,
          url,
          method,
          errorType,
          originalError: errorMessage,
          operation: 'http_request',
        },
      };
    }
  }

  /**
   * 构建完整 URL（包含查询参数）
   */
  private buildUrl(baseUrl: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const urlObj = new URL(baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    });

    return urlObj.toString();
  }

  /**
   * 解析响应内容
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/')) {
        return await response.text();
      } else {
        // 对于其他类型，返回基本信息
        return {
          type: 'binary',
          contentType,
          size: response.headers.get('content-length') || 'unknown',
        };
      }
    } catch (parseError) {
      // 如果解析失败，返回原始文本
      return await response.text();
    }
  }

  /**
   * 获取工具使用示例
   */
  public getExamples(): string[] {
    return [
      '{"url": "https://api.github.com/users/octocat"}',
      '{"url": "https://httpbin.org/post", "method": "POST", "body": {"key": "value"}}',
      '{"url": "https://api.example.com/data", "headers": {"Authorization": "Bearer token"}}',
      '{"url": "https://api.example.com/search", "params": {"q": "query", "limit": 10}}',
    ];
  }

  /**
   * 获取工具帮助信息
   */
  public getHelp(): string {
    return `
${super.getHelp()}

参数说明:
- url: 请求 URL（必需）
- method: HTTP 方法（可选，默认 GET）
- headers: 请求头（可选）
- params: 查询参数（可选）
- body: 请求体（可选，仅 POST/PUT/PATCH）
- timeout: 超时时间毫秒（可选，默认 10000）
- followRedirects: 是否跟随重定向（可选，默认 true）

支持的 HTTP 方法:
- GET: 获取数据
- POST: 创建数据
- PUT: 更新数据
- DELETE: 删除数据
- PATCH: 部分更新
- HEAD: 获取头信息
- OPTIONS: 获取支持的方法

使用示例:
${this.getExamples()
  .map(example => `  ${example}`)
  .join('\n')}
    `.trim();
  }
}
