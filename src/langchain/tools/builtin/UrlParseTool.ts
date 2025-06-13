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
 * URL 解析工具
 * 解析URL的各个组成部分，提供详细的URL分析信息
 */
export class UrlParseTool extends BladeTool {
  constructor() {
    const config: BladeToolConfig = {
      name: 'url_parse',
      description: '解析URL的各个组成部分，提供详细的URL分析和验证',
      category: ToolCategory.NETWORK,
      tags: ['url', 'parse', 'analysis', 'validation', 'network'],
      version: '2.0.0',
      author: 'Blade AI Team',
      requiresConfirmation: false,
      riskLevel: RiskLevel.SAFE,
    };

    super(config);
  }

  protected createSchema(): z.ZodSchema<any> {
    return z.object({
      url: z.string().min(1, 'URL不能为空'),
      includeAnalysis: z.boolean().default(true),
      validateDomain: z.boolean().default(false),
      extractMetadata: z.boolean().default(true),
    });
  }

  protected async executeInternal(
    params: {
      url: string;
      includeAnalysis?: boolean;
      validateDomain?: boolean;
      extractMetadata?: boolean;
    },
    context: ToolExecutionContext
  ): Promise<BladeToolResult> {
    const { url, includeAnalysis = true, validateDomain = false, extractMetadata = true } = params;
    const startTime = Date.now();

    try {
      // 基本URL解析
      const urlObj = new URL(url);

      // 解析查询参数
      const queryParams: Record<string, string | string[]> = {};
      urlObj.searchParams.forEach((value, key) => {
        if (queryParams[key]) {
          // 处理同名参数
          if (Array.isArray(queryParams[key])) {
            (queryParams[key] as string[]).push(value);
          } else {
            queryParams[key] = [queryParams[key] as string, value];
          }
        } else {
          queryParams[key] = value;
        }
      });

      // 基本组件
      const components = {
        original: url,
        protocol: urlObj.protocol,
        host: urlObj.host,
        hostname: urlObj.hostname,
        port: urlObj.port || this.getDefaultPort(urlObj.protocol),
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        origin: urlObj.origin,
        username: urlObj.username,
        password: urlObj.password ? '***' : '', // 隐藏密码
        queryParams,
      };

      // URL分析
      let analysis: any = {};
      if (includeAnalysis) {
        analysis = {
          isSecure: urlObj.protocol === 'https:',
          isLocalhost: this.isLocalhost(urlObj.hostname),
          isIP: this.isIPAddress(urlObj.hostname),
          isValidDomain: this.isValidDomain(urlObj.hostname),
          hasCredentials: !!(urlObj.username || urlObj.password),
          hasQuery: urlObj.search.length > 0,
          hasFragment: urlObj.hash.length > 0,
          pathSegments: this.getPathSegments(urlObj.pathname),
          queryCount: Object.keys(queryParams).length,
          urlLength: url.length,
          complexity: this.calculateComplexity(url, queryParams),
        };
      }

      // 元数据提取
      let metadata: any = {};
      if (extractMetadata) {
        metadata = {
          scheme: urlObj.protocol.replace(':', ''),
          standardPort: this.getDefaultPort(urlObj.protocol),
          isDefaultPort: !urlObj.port || urlObj.port === this.getDefaultPort(urlObj.protocol),
          domainLevels: this.getDomainLevels(urlObj.hostname),
          fileExtension: this.getFileExtension(urlObj.pathname),
          isAPI: this.isAPIEndpoint(urlObj.pathname),
          isWebPage: this.isWebPage(urlObj.pathname),
          security: this.analyzeSecurityAspects(urlObj),
        };
      }

      // 域名验证
      let domainValidation: any = {};
      if (validateDomain && !this.isIPAddress(urlObj.hostname)) {
        domainValidation = await this.validateDomainAsync(urlObj.hostname);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          components,
          analysis,
          metadata,
          domainValidation: validateDomain ? domainValidation : undefined,
          recommendations: this.generateRecommendations(urlObj, analysis),
        },
        duration: executionTime,
        metadata: {
          operation: 'url_parse',
          executionTime,
          executionId: context.executionId,
          parseConfig: {
            includeAnalysis,
            validateDomain,
            extractMetadata,
          },
          urlInfo: {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            hasQuery: !!urlObj.search,
            hasFragment: !!urlObj.hash,
            pathDepth: this.getPathSegments(urlObj.pathname).length,
          },
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        error: `URL解析失败: ${error.message}`,
        duration: executionTime,
        metadata: {
          operation: 'url_parse',
          executionTime,
          executionId: context.executionId,
          errorType: error.constructor.name,
          parseConfig: {
            url,
            includeAnalysis,
            validateDomain,
            extractMetadata,
          },
        },
      };
    }
  }

  /**
   * 获取协议默认端口
   */
  private getDefaultPort(protocol: string): string {
    const defaults: Record<string, string> = {
      'http:': '80',
      'https:': '443',
      'ftp:': '21',
      'ssh:': '22',
      'telnet:': '23',
      'smtp:': '25',
      'dns:': '53',
      'pop3:': '110',
      'imap:': '143',
    };
    return defaults[protocol] || '';
  }

  /**
   * 检查是否为localhost
   */
  private isLocalhost(hostname: string): boolean {
    return ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname.toLowerCase());
  }

  /**
   * 检查是否为IP地址
   */
  private isIPAddress(hostname: string): boolean {
    // IPv4 正则
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 正则（简化版）
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(hostname) || ipv6Regex.test(hostname);
  }

  /**
   * 检查是否为有效域名
   */
  private isValidDomain(hostname: string): boolean {
    if (this.isIPAddress(hostname) || this.isLocalhost(hostname)) {
      return true;
    }

    // 简单的域名验证
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(hostname);
  }

  /**
   * 获取路径段
   */
  private getPathSegments(pathname: string): string[] {
    return pathname.split('/').filter(segment => segment.length > 0);
  }

  /**
   * 获取域名层级
   */
  private getDomainLevels(hostname: string): string[] {
    if (this.isIPAddress(hostname) || this.isLocalhost(hostname)) {
      return [hostname];
    }
    return hostname.split('.').reverse();
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(pathname: string): string | null {
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];
    const dotIndex = lastSegment.lastIndexOf('.');

    if (dotIndex > 0 && dotIndex < lastSegment.length - 1) {
      return lastSegment.substring(dotIndex + 1);
    }

    return null;
  }

  /**
   * 检查是否为API端点
   */
  private isAPIEndpoint(pathname: string): boolean {
    const apiPatterns = ['/api/', '/v1/', '/v2/', '/rest/', '/graphql', '/rpc/'];
    return apiPatterns.some(pattern => pathname.includes(pattern));
  }

  /**
   * 检查是否为网页
   */
  private isWebPage(pathname: string): boolean {
    const webExtensions = ['html', 'htm', 'php', 'asp', 'jsp'];
    const extension = this.getFileExtension(pathname);
    return !extension || webExtensions.includes(extension.toLowerCase());
  }

  /**
   * 计算URL复杂度
   */
  private calculateComplexity(url: string, queryParams: Record<string, any>): number {
    let complexity = 0;

    // URL长度贡献
    complexity += Math.min(url.length / 10, 50);

    // 查询参数贡献
    complexity += Object.keys(queryParams).length * 5;

    // 路径深度贡献
    const pathDepth = url.split('/').length - 3; // 减去协议和域名部分
    complexity += pathDepth * 3;

    return Math.round(complexity);
  }

  /**
   * 分析安全方面
   */
  private analyzeSecurityAspects(urlObj: URL): any {
    return {
      usesHTTPS: urlObj.protocol === 'https:',
      exposesCredentials: !!(urlObj.username || urlObj.password),
      hasIPAddress: this.isIPAddress(urlObj.hostname),
      isInternalNetwork: this.isLocalhost(urlObj.hostname) || this.isPrivateIP(urlObj.hostname),
      suspiciousChars: this.hasSuspiciousCharacters(urlObj.href),
      lengthWarning: urlObj.href.length > 2000,
    };
  }

  /**
   * 检查是否为私有IP
   */
  private isPrivateIP(hostname: string): boolean {
    if (!this.isIPAddress(hostname)) return false;

    const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * 检查是否包含可疑字符
   */
  private hasSuspiciousCharacters(url: string): boolean {
    const suspiciousPatterns = [
      /%[0-9a-fA-F]{2}/g, // URL编码
      /[<>\"']/, // HTML特殊字符
      /javascript:/i, // JavaScript协议
      /data:/i, // Data协议
    ];

    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  /**
   * 域名验证（异步）
   */
  private async validateDomainAsync(hostname: string): Promise<any> {
    try {
      const dns = await import('dns').then(m => m.promises);

      const [addresses] = await Promise.allSettled([dns.resolve4(hostname).catch(() => [])]);

      return {
        isResolvable: addresses.status === 'fulfilled' && addresses.value.length > 0,
        ipAddresses: addresses.status === 'fulfilled' ? addresses.value : [],
        error: addresses.status === 'rejected' ? addresses.reason.message : null,
      };
    } catch (error) {
      return {
        isResolvable: false,
        error: '域名验证失败',
      };
    }
  }

  /**
   * 生成建议
   */
  private generateRecommendations(urlObj: URL, analysis: any): string[] {
    const recommendations: string[] = [];

    if (!analysis.isSecure && urlObj.hostname !== 'localhost') {
      recommendations.push('考虑使用HTTPS以提高安全性');
    }

    if (analysis.hasCredentials) {
      recommendations.push('避免在URL中包含用户名和密码');
    }

    if (analysis.urlLength > 2000) {
      recommendations.push('URL过长，可能影响兼容性');
    }

    if (analysis.queryCount > 10) {
      recommendations.push('查询参数过多，考虑简化或使用POST请求');
    }

    if (analysis.complexity > 100) {
      recommendations.push('URL结构复杂，考虑简化设计');
    }

    return recommendations;
  }
}
