/**
 * 配置验证工具函数
 */

import { z } from 'zod';
import { BladeUnifiedConfigSchema } from '../types/schemas.js';

/**
 * 验证配置对象
 */
export function validateConfig(config: any): { 
  valid: boolean; 
  errors: string[]; 
  warnings: string[];
  normalized: any;
} {
  try {
    // 使用 Zod 进行验证
    const validated = BladeUnifiedConfigSchema.parse(config);
    
    return {
      valid: true,
      errors: [],
      warnings: [],
      normalized: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      
      const warnings = error.errors
        .filter(err => err.code === z.ZodIssueCode.invalid_type)
        .map(err => {
          const path = err.path.join('.');
          return `${path}: 类型可能不匹配，尝试自动转换`;
        });
      
      return {
        valid: false,
        errors,
        warnings,
        normalized: null,
      };
    }
    
    return {
      valid: false,
      errors: [`验证失败: ${error instanceof Error ? error.message : '未知错误'}`],
      warnings: [],
      normalized: null,
    };
  }
}

/**
 * 安全解析配置值
 */
export function safeParseConfigValue(value: string, expectedType?: string): any {
  // 尝试解析为不同类型
  if (expectedType) {
    switch (expectedType) {
      case 'number':
        const numValue = Number(value);
        return isNaN(numValue) ? value : numValue;
      case 'boolean':
        if (value.toLowerCase() === 'true' || value === '1') return true;
        if (value.toLowerCase() === 'false' || value === '0') return false;
        return value;
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value.split(',').map(v => v.trim());
        }
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
    }
  }
  
  // 自动推断类型
  if (value === null || value === undefined) {
    return value;
  }
  
  // 尝试解析为数字
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  
  // 尝试解析为浮点数
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }
  
  // 尝试解析为布尔值
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // 尝试解析为 JSON 对象或数组
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      // 不是有效的 JSON，返回原字符串
    }
  }
  
  // 返回原字符串
  return value;
}

/**
 * 验证配置路径
 */
export function validateConfigPath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }
  
  // 检查路径格式
  const pathRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
  return pathRegex.test(path);
}

/**
 * 验证配置值
 */
export function validateConfigValue(path: string, value: any, schema?: z.ZodSchema<any>): {
  valid: boolean;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // 基本验证
  if (value === undefined || value === null) {
    errors.push(`${path}: 值不能为 null 或 undefined`);
    return { valid: false, errors, suggestions };
  }
  
  // 类型特定验证
  if (schema) {
    try {
      schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          if (err.code === z.ZodIssueCode.invalid_type) {
            errors.push(`${path}: 期望 ${err.expected} 但得到 ${err.received}`);
          } else if (err.code === z.ZodIssueCode.too_small) {
            errors.push(`${path}: 值太小，最小值 ${err.minimum}`);
          } else if (err.code === z.ZodIssueCode.too_big) {
            errors.push(`${path}: 值太大，最大值 ${err.maximum}`);
          } else if (err.code === z.ZodIssueCode.invalid_string) {
            errors.push(`${path}: 字符串格式无效，期望 ${err.validation}`);
          } else {
            errors.push(`${path}: ${err.message}`);
          }
        });
      }
    }
  }
  
  // 通用验证建议
  if (typeof value === 'string') {
    if (value.length > 1000) {
      suggestions.push(`${path}: 字符串长度较大，考虑优化`);
    }
    if (value.trim() !== value) {
      suggestions.push(`${path}: 字符串包含前后空格`);
    }
  }
  
  if (Array.isArray(value)) {
    if (value.length > 100) {
      suggestions.push(`${path}: 数组长度较大，可能影响性能`);
    }
    if (value.some(item => item === undefined || item === null)) {
      errors.push(`${path}: 数组包含 null 或 undefined 项`);
    }
  }
  
  if (typeof value === 'object' && !Array.isArray(value)) {
    if (Object.keys(value).length > 50) {
      suggestions.push(`${path}: 对象属性较多，考虑优化结构`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}

/**
 * 验证配置文件格式
 */
export function validateConfigFormat(content: string, format: 'json' | 'yaml' | 'toml'): {
  valid: boolean;
  error?: string;
  parsed?: any;
} {
  try {
    switch (format) {
      case 'json':
        const jsonParsed = JSON.parse(content);
        return { valid: true, parsed: jsonParsed };
      
      case 'yaml':
        // 这里需要引入 YAML 解析器，例如 js-yaml
        // 暂时返回不支持
        return { 
          valid: false, 
          error: 'YAML 格式暂不支持，请使用 JSON 格式' 
        };
      
      case 'toml':
        // 这里需要引入 TOML 解析器，例如 @iarna/toml
        // 暂时返回不支持
        return { 
          valid: false, 
          error: 'TOML 格式暂不支持，请使用 JSON 格式' 
        };
      
      default:
        return { 
          valid: false, 
          error: `不支持的格式: ${format}` 
        };
    }
  } catch (error) {
    return {
      valid: false,
      error: `解析失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 验证环境变量
 */
export function validateEnvironmentVariables(): {
  valid: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // 检查 Blade 相关环境变量
  const bladeEnvVars = [
    'BLADE_API_KEY',
    'BLADE_BASE_URL',
    'BLADE_MODEL',
    'BLADE_DEBUG',
    'BLADE_CONFIG_FILE'
  ];
  
  const missingRequired = [];
  const presentOptional = [];
  
  // 检查必需的环境变量
  if (!process.env.BLADE_API_KEY) {
    missingRequired.push('BLADE_API_KEY');
    suggestions.push('设置 BLADE_API_KEY 环境变量以启用认证');
  }
  
  // 检查可选环境变量
  bladeEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      presentOptional.push(envVar);
    }
  });
  
  // 生成警告和建议
  if (missingRequired.length > 0) {
    warnings.push(`缺少必需的环境变量: ${missingRequired.join(', ')}`);
  }
  
  if (presentOptional.length > 0) {
    suggestions.push(`可选环境变量已设置: ${presentOptional.join(', ')}`);
  }
  
  // 检查 Node.js 版本
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (majorVersion < 16) {
    warnings.push(`Node.js 版本过低: ${nodeVersion}，建议升级到 16.0.0 或更高版本`);
  }
  
  return {
    valid: missingRequired.length === 0,
    warnings,
    suggestions,
  };
}

/**
 * 验证配置文件路径
 */
export function validateConfigPathExists(path: string): Promise<{
  valid: boolean;
  error?: string;
  exists: boolean;
}> {
  const fs = require('fs').promises;
  
  return fs.access(path)
    .then(() => ({
      valid: true,
      exists: true,
    }))
    .catch((error: any) => {
      if (error.code === 'ENOENT') {
        return {
          valid: true,
          exists: false,
        };
      }
      return {
        valid: false,
        exists: false,
        error: `无法访问路径 ${path}: ${error.message}`,
      };
    });
}

/**
 * 验证配置权限
 */
export function validateConfigPermissions(config: any): {
  valid: boolean;
  securityWarnings: string[];
  privacyWarnings: string[];
} {
  const securityWarnings: string[] = [];
  const privacyWarnings: string[] = [];
  
  // 检查敏感信息
  const sensitiveFields = ['apiKey', 'secret', 'password', 'token', 'key'];
  const sensitiveValuesFound: string[] = [];
  
  const checkForSensitiveValues = (obj: any, path = '') => {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          if (typeof value === 'string' && value.length > 0) {
            sensitiveValuesFound.push(currentPath);
          }
        }
        
        if (typeof value === 'object' && value !== null) {
          checkForSensitiveValues(value, currentPath);
        }
      }
    }
  };
  
  checkForSensitiveValues(config);
  
  if (sensitiveValuesFound.length > 0) {
    privacyWarnings.push(`配置中包含敏感信息字段: ${sensitiveValuesFound.join(', ')}`);
    securityWarnings.push('建议移除敏感信息或使用环境变量');
  }
  
  // 检查网络配置安全性
  if (config.auth?.baseUrl) {
    const baseUrl = config.auth.baseUrl;
    if (!baseUrl.startsWith('https://')) {
      securityWarnings.push('基础 URL 应使用 HTTPS 协议');
    }
  }
  
  return {
    valid: securityWarnings.length === 0,
    securityWarnings,
    privacyWarnings,
  };
}