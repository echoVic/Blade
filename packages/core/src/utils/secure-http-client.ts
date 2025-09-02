/**
 * 安全的 HTTP 客户端
 * 提供增强的安全特性
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import https from 'https';
import { createHash, createHmac } from 'crypto';
import crypto from 'crypto';

export interface SecureHttpClientOptions {
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  validateCertificates?: boolean;
  enforceTLS12?: boolean;
  allowedHosts?: string[];
  rateLimit?: {
    requests: number;
    period: number; // 毫秒
  };
}

export class SecureHttpClient {
  private client: AxiosInstance;
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  private options: Required<SecureHttpClientOptions>;

  constructor(options: SecureHttpClientOptions = {}) {
    this.options = {
      baseURL: options.baseURL || '',
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      validateCertificates: options.validateCertificates !== false,
      enforceTLS12: options.enforceTLS12 !== false,
      allowedHosts: options.allowedHosts || [],
      rateLimit: options.rateLimit || { requests: 100, period: 60000 },
    };

    this.client = this.createSecureClient();
  }

  /**
   * 创建安全的 Axios 客户端
   */
  private createSecureClient(): AxiosInstance {
    const agent = new https.Agent({
      // 强制 TLS 1.2+
      minVersion: this.options.enforceTLS12 ? 'TLSv1.2' : 'TLSv1',
      maxVersion: 'TLSv1.3',
      
      // 禁用弱加密套件
      ciphers: this.getSecureCiphers(),
      
      // 安全选项
      honorCipherOrder: true,
      rejectUnauthorized: this.options.validateCertificates,
      
      // 禁用不安全的协议
      secureOptions: crypto.constants.SSL_OP_NO_SSLv3 | 
                     crypto.constants.SSL_OP_NO_TLSv1 |
                     crypto.constants.SSL_OP_NO_TLSv1_1,
    });

    const client = axios.create({
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      httpsAgent: agent,
      // 安全的默认头
      headers: {
        'User-Agent': `Blade-AI-Secure/${process.env.npm_package_version || '1.0.0'}`,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      },
    });

    // 请求拦截器
    client.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    client.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );

    return client;
  }

  /**
   * 处理请求
   */
  private async handleRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    // 1. 验证 URL
    if (config.url) {
      const url = new URL(config.url, this.options.baseURL);
      
      // 检查协议
      if (url.protocol !== 'https:' && !url.href.startsWith('http://localhost')) {
        throw new Error('只允许 HTTPS 请求');
      }
      
      // 检查主机白名单
      if (this.options.allowedHosts.length > 0) {
        const hostname = url.hostname;
        if (!this.options.allowedHosts.includes(hostname)) {
          throw new Error(`主机不在允许列表中: ${hostname}`);
        }
      }
      
      // 检查速率限制
      await this.checkRateLimit(hostname);
    }

    // 2. 添加安全头
    if (!config.headers) {
      config.headers = {};
    }
    
    // 添加请求 ID 用于追踪
    config.headers['X-Request-ID'] = this.generateRequestId();
    
    // 添加时间戳防止重放攻击
    config.headers['X-Timestamp'] = Date.now().toString();

    // 3. 签名请求（如果配置了密钥）
    const secret = process.env.BLADE_REQUEST_SECRET;
    if (secret && config.headers['Authorization']) {
      const signature = this.signRequest(config, secret);
      config.headers['X-Signature'] = signature;
    }

    return config;
  }

  /**
   * 处理响应
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    // 记录响应时间（用于监控）
    const responseTime = Date.now() - parseInt(response.config.headers?.['X-Timestamp'] || '0');
    response.headers['X-Response-Time'] = responseTime.toString();

    // 验证响应签名（如果存在）
    const signature = response.headers['x-signature'];
    const secret = process.env.BLADE_REQUEST_SECRET;
    if (signature && secret) {
      this.verifyResponseSignature(response, secret, signature);
    }

    return response;
  }

  /**
   * 处理错误
   */
  private async handleError(error: AxiosError): Promise<never> {
    // 增强错误信息
    if (error.response) {
      // 服务器返回了错误状态码
      const status = error.response.status;
      const data = error.response.data;

      // 特殊处理 TLS 错误
      if (error.code === 'CERT_HAS_EXPIRED') {
        throw new Error('服务器证书已过期，请联系管理员');
      }
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        throw new Error('无法验证服务器证书，可能存在中间人攻击');
      }
      if (error.code === 'ECONNREFUSED') {
        throw new Error('无法连接到服务器，请检查网络连接');
      }

      // 根据状态码提供友好的错误信息
      let message = '请求失败';
      if (status === 401) message = '认证失败，请检查凭据';
      else if (status === 403) message = '访问被拒绝，权限不足';
      else if (status === 404) message = '请求的资源不存在';
      else if (status === 429) message = '请求过于频繁，请稍后重试';
      else if (status >= 500) message = '服务器内部错误';
      else if (status >= 400) message = '请求参数错误';

      // 创建增强错误
      const enhancedError = new Error(message) as any;
      enhancedError.code = error.code;
      enhancedError.status = status;
      enhancedError.data = data;
      enhancedError.config = error.config;
      
      throw enhancedError;
    } else if (error.request) {
      // 请求已发送但无响应
      throw new Error('网络错误：未收到服务器响应');
    } else {
      // 请求配置错误
      throw new Error(`请求配置错误: ${error.message}`);
    }
  }

  /**
   * 获取安全的加密套件列表
   */
  private getSecureCiphers(): string {
    return [
      // TLS 1.3
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      
      // TLS 1.2
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      
      // 向后兼容（但较弱的）
      'ECDHE-ECDSA-AES256-SHA384',
      'ECDHE-RSA-AES256-SHA384',
      'ECDHE-ECDSA-AES128-SHA256',
      'ECDHE-RSA-AES128-SHA256',
    ].join(':');
  }

  /**
   * 检查速率限制
   */
  private async checkRateLimit(hostname: string): Promise<void> {
    const now = Date.now();
    const key = hostname;
    
    let limit = this.rateLimitMap.get(key);
    
    // 重置过期的计数
    if (!limit || now > limit.resetTime) {
      limit = {
        count: 1,
        resetTime: now + this.options.rateLimit.period,
      };
      this.rateLimitMap.set(key, limit);
      return;
    }
    
    // 检查是否超过限制
    if (limit.count >= this.options.rateLimit.requests) {
      const waitTime = limit.resetTime - now;
      throw new Error(`请求过于频繁，请等待 ${Math.ceil(waitTime / 1000)} 秒后重试`);
    }
    
    // 增加计数
    limit.count++;
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return crypto.randomUUID();
  }

  /**
   * 签名请求
   */
  private signRequest(config: AxiosRequestConfig, secret: string): string {
    const timestamp = config.headers?.['X-Timestamp'] as string;
    const requestId = config.headers?.['X-Request-ID'] as string;
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    
    // 构建签名数据
    const data = `${timestamp}:${requestId}:${method}:${url}`;
    
    // 使用 HMAC-SHA256 签名
    return createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * 验证响应签名
   */
  private verifyResponseSignature(
    response: AxiosResponse,
    secret: string,
    signature: string
  ): void {
    const expectedSignature = this.signRequest(response.config, secret);
    
    if (signature !== expectedSignature) {
      throw new Error('响应签名验证失败，响应可能被篡改');
    }
  }

  /**
   * 获取客户端实例
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * 设置新的速率限制
   */
  setRateLimit(requests: number, period: number): void {
    this.options.rateLimit = { requests, period };
    // 清空现有限制
    this.rateLimitMap.clear();
  }

  /**
   * 添加允许的主机
   */
  addAllowedHost(host: string): void {
    if (!this.options.allowedHosts.includes(host)) {
      this.options.allowedHosts.push(host);
    }
  }

  /**
   * 移除允许的主机
   */
  removeAllowedHost(host: string): void {
    const index = this.options.allowedHosts.indexOf(host);
    if (index > -1) {
      this.options.allowedHosts.splice(index, 1);
    }
  }

  /**
   * 创建安全的 GET 请求
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  /**
   * 创建安全的 POST 请求
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * 创建安全的 PUT 请求
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * 创建安全的 DELETE 请求
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  /**
   * 创建安全的 PATCH 请求
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * 创建带重试的请求
   */
  async withRetry<T>(
    requestFn: () => Promise<T>,
    retryCount = this.options.retryAttempts
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      if (retryCount <= 0 || !this.shouldRetry(error)) {
        throw error;
      }
      
      // 指数退避
      const delay = this.options.retryDelay * Math.pow(2, this.options.retryAttempts - retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return this.withRetry(requestFn, retryCount - 1);
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any): boolean {
    // 只对某些错误码重试
    const retryableCodes = [
      'ECONNRESET',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
    ];
    
    const retryableStatus = [408, 429, 500, 502, 503, 504];
    
    return (
      retryableCodes.includes(error.code) ||
      (error.response && retryableStatus.includes(error.response.status))
    );
  }
}