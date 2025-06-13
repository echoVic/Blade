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
 * HTTP GET 请求工具
 * 发送 HTTP GET 请求获取数据
 */
export class HttpGetTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'http_get',
      description: '发送 HTTP GET 请求获取数据',
      category: ToolCategory.NETWORK,
      tags: ['http', 'request', 'get', 'network', 'api'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.MODERATE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      url: z.string().url('请提供有效的 URL'),
      headers: z.record(z.string()).optional().default({}),
      timeout: z.number().positive().max(60000).default(10000),
      followRedirects: z.boolean().default(true),
      maxRedirects: z.number().positive().max(10).default(5),
    });
  }

  protected async executeInternal(
    params: {
      url: string;
      headers?: Record<string, string>;
      timeout?: number;
      followRedirects?: boolean;
      maxRedirects?: number;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { url, headers = {}, timeout = 10000, followRedirects = true, maxRedirects = 5 } = params;
    const startTime = Date.now();

    try {
      // 动态导入 axios
      const axios = (await import('axios')).default;

      const config = {
        method: 'GET' as const,
        url,
        headers: {
          'User-Agent': 'Blade-AI-Agent/2.0.0',
          Accept: 'application/json, text/plain, */*',
          ...headers,
        },
        timeout,
        validateStatus: () => true, // 接受所有状态码
        maxRedirects: followRedirects ? maxRedirects : 0,
      };

      const response = await axios(config);
      const executionTime = Date.now() - startTime;

      // 处理响应数据
      let responseData = response.data;
      let contentType = 'unknown';

      if (response.headers['content-type']) {
        contentType = response.headers['content-type'].split(';')[0];
      }

      // 如果是文本数据且过长，截断处理
      if (typeof responseData === 'string' && responseData.length > 10000) {
        responseData = responseData.substring(0, 10000) + '... (截断)';
      }

      return {
        success: true,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: responseData,
          contentType,
          url: response.config.url,
          redirected: response.request.redirected || false,
        },
        duration: executionTime,
        metadata: {
          operation: 'http_get',
          executionTime,
          executionId: context.executionId,
          requestConfig: {
            url,
            headers: config.headers,
            timeout,
            followRedirects,
          },
          responseInfo: {
            status: response.status,
            contentLength: this.getContentLength(response),
            contentType,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      let errorMessage = error.message;
      let errorCode = 'UNKNOWN_ERROR';

      if (error.code) {
        errorCode = error.code;
      } else if (error.response) {
        errorCode = `HTTP_${error.response.status}`;
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: `HTTP GET 请求失败: ${errorMessage}`,
        duration: executionTime,
        metadata: {
          operation: 'http_get',
          executionTime,
          executionId: context.executionId,
          errorCode,
          errorType: error.constructor.name,
          requestConfig: {
            url,
            headers,
            timeout,
          },
          responseInfo: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
              }
            : undefined,
        },
      };
    }
  }

  /**
   * 获取响应内容长度
   */
  private getContentLength(response: any): number {
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      return parseInt(contentLength, 10);
    }

    if (typeof response.data === 'string') {
      return response.data.length;
    }

    if (response.data && typeof response.data === 'object') {
      return JSON.stringify(response.data).length;
    }

    return 0;
  }
}
