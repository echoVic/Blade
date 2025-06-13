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
 * HTTP POST 请求工具
 * 发送 HTTP POST 请求，支持多种数据格式
 */
export class HttpPostTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'http_post',
      description: '发送 HTTP POST 请求，支持 JSON、表单数据等多种格式',
      category: ToolCategory.NETWORK,
      tags: ['http', 'post', 'request', 'api', 'network'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: true,
      riskLevel: RiskLevel.HIGH,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      url: z.string().url('请提供有效的 URL'),
      data: z.union([z.string(), z.object({}).passthrough()]).optional(),
      headers: z.record(z.string()).optional().default({}),
      contentType: z
        .enum([
          'application/json',
          'application/x-www-form-urlencoded',
          'text/plain',
          'multipart/form-data',
        ])
        .default('application/json'),
      timeout: z.number().positive().max(60000).default(10000),
      followRedirects: z.boolean().default(true),
      maxRedirects: z.number().positive().max(10).default(5),
      validateSSL: z.boolean().default(true),
    });
  }

  protected async executeInternal(
    params: {
      url: string;
      data?: string | object;
      headers?: Record<string, string>;
      contentType?: string;
      timeout?: number;
      followRedirects?: boolean;
      maxRedirects?: number;
      validateSSL?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const {
      url,
      data,
      headers = {},
      contentType = 'application/json',
      timeout = 10000,
      followRedirects = true,
      maxRedirects = 5,
      validateSSL = true,
    } = params;
    const startTime = Date.now();

    try {
      // 动态导入 axios
      const axios = (await import('axios')).default;

      // 准备请求数据
      const requestData = this.prepareRequestData(data, contentType);

      // 构建请求配置
      const config = {
        method: 'POST' as const,
        url,
        data: requestData,
        headers: {
          'User-Agent': 'Blade-AI-Agent/2.0.0',
          'Content-Type': contentType,
          ...headers,
        },
        timeout,
        validateStatus: () => true, // 接受所有状态码
        maxRedirects: followRedirects ? maxRedirects : 0,
        httpsAgent: validateSSL
          ? undefined
          : new (await import('https')).Agent({
              rejectUnauthorized: false,
            }),
      };

      const response = await axios(config);
      const executionTime = Date.now() - startTime;

      // 处理响应数据
      let responseData = response.data;
      let contentTypeHeader = 'unknown';

      if (response.headers['content-type']) {
        contentTypeHeader = response.headers['content-type'].split(';')[0];
      }

      // 如果是文本数据且过长，截断处理
      if (typeof responseData === 'string' && responseData.length > 10000) {
        responseData = responseData.substring(0, 10000) + '... (截断)';
      }

      // 分析响应状态
      const isSuccess = response.status >= 200 && response.status < 300;
      const isClientError = response.status >= 400 && response.status < 500;
      const isServerError = response.status >= 500;

      return {
        success: isSuccess,
        data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: responseData,
          contentType: contentTypeHeader,
          url: response.config.url,
          redirected: response.request.redirected || false,
          requestData:
            typeof requestData === 'string' && requestData.length > 1000
              ? requestData.substring(0, 1000) + '... (截断)'
              : requestData,
        },
        duration: executionTime,
        metadata: {
          operation: 'http_post',
          executionTime,
          executionId: context.executionId,
          requestConfig: {
            url,
            contentType,
            headers: config.headers,
            timeout,
            followRedirects,
            validateSSL,
          },
          responseInfo: {
            status: response.status,
            statusCategory: isSuccess
              ? 'success'
              : isClientError
                ? 'client_error'
                : isServerError
                  ? 'server_error'
                  : 'unknown',
            contentLength: this.getContentLength(response),
            contentType: contentTypeHeader,
            hasData: !!responseData,
          },
          performance: {
            requestSize: this.getRequestSize(requestData),
            responseSize: this.getContentLength(response),
            networkTime: executionTime,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      let errorMessage = error.message;
      let errorCode = 'UNKNOWN_ERROR';
      let errorCategory = 'network';

      if (error.code) {
        errorCode = error.code;

        // 分类网络错误
        if (error.code === 'ECONNREFUSED') {
          errorCategory = 'connection';
          errorMessage = '连接被拒绝，服务器可能未运行';
        } else if (error.code === 'ENOTFOUND') {
          errorCategory = 'dns';
          errorMessage = '域名解析失败';
        } else if (error.code === 'ECONNRESET') {
          errorCategory = 'connection';
          errorMessage = '连接被重置';
        } else if (error.code === 'ETIMEDOUT') {
          errorCategory = 'timeout';
          errorMessage = '请求超时';
        }
      } else if (error.response) {
        errorCode = `HTTP_${error.response.status}`;
        errorCategory = 'http';
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      }

      return {
        success: false,
        error: `HTTP POST 请求失败: ${errorMessage}`,
        duration: executionTime,
        metadata: {
          operation: 'http_post',
          executionTime,
          executionId: context.executionId,
          errorCode,
          errorCategory,
          errorType: error.constructor.name,
          requestConfig: {
            url,
            contentType,
            headers,
            timeout,
          },
          responseInfo: error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: error.response.data,
              }
            : undefined,
        },
      };
    }
  }

  /**
   * 准备请求数据
   */
  private prepareRequestData(data: string | object | undefined, contentType: string): any {
    if (!data) {
      return undefined;
    }

    switch (contentType) {
      case 'application/json':
        return typeof data === 'string' ? data : JSON.stringify(data);

      case 'application/x-www-form-urlencoded':
        if (typeof data === 'object') {
          return new URLSearchParams(data as Record<string, string>).toString();
        }
        return data;

      case 'text/plain':
        return typeof data === 'string' ? data : JSON.stringify(data);

      case 'multipart/form-data':
        // 对于 multipart/form-data，我们让 axios 自动处理
        return data;

      default:
        return data;
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

  /**
   * 获取请求数据大小
   */
  private getRequestSize(data: any): number {
    if (!data) return 0;

    if (typeof data === 'string') {
      return data.length;
    }

    if (typeof data === 'object') {
      return JSON.stringify(data).length;
    }

    return 0;
  }
}
