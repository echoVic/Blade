/**
 * 配置合并工具函数
 */

import { 
  ConfigLayer, 
  CONFIG_PRIORITY, 
  ConfigMergeResult, 
  ConfigConflict,
  BladeUnifiedConfig 
} from '../types/index.js';

/**
 * 深度合并两个对象
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const targetValue = result[key];
      const sourceValue = source[key];
      
      if (
        typeof targetValue === 'object' && 
        typeof sourceValue === 'object' && 
        targetValue !== null && 
        sourceValue !== null &&
        !Array.isArray(targetValue) && 
        !Array.isArray(sourceValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as T[typeof key];
      }
    }
  }
  
  return result;
}

/**
 * 按优先级合并多个配置源
 */
export function mergeConfigsByPriority<T extends Record<string, any>>(
  configs: Record<ConfigLayer, T>,
  options: {
    overrideArrays?: boolean;
    mergeArrays?: boolean;
    resolveConflicts?: (conflict: ConfigConflict) => any;
  } = {}
): ConfigMergeResult {
  const {
    overrideArrays = true,
    mergeArrays = false,
    resolveConflicts = defaultConflictResolver
  } = options;
  
  const merged: T = {} as T;
  const conflicts: ConfigConflict[] = [];
  const warnings: string[] = [];
  const sources: string[] = [];
  
  // 按优先级从低到高合并配置
  CONFIG_PRIORITY.slice().reverse().forEach(layer => {
    const config = configs[layer];
    if (config) {
      const layerName = `config-${layer}`;
      sources.push(layerName);
      
      // 检查冲突
      const layerConflicts = findConflicts(merged, config, layer);
      conflicts.push(...layerConflicts);
      
      // 合并配置
      mergeObjects(merged, config, {
        overrideArrays,
        mergeArrays,
        conflicts: layerConflicts,
        resolveConflicts,
      });
    }
  });
  
  return { 
    merged, 
    conflicts, 
    warnings, 
    sources 
  };
}

/**
 * 查找配置冲突
 */
export function findConflicts<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  sourceLayer: ConfigLayer
): ConfigConflict[] {
  const conflicts: ConfigConflict[] = [];
  
  for (const key in source) {
    if (source.hasOwnProperty(key) && target.hasOwnProperty(key)) {
      const targetValue = target[key];
      const sourceValue = source[key];
      
      if (!isEqual(targetValue, sourceValue)) {
        const conflict: ConfigConflict = {
          path: key,
          sources: ['target', `source-${sourceLayer}`],
          values: [targetValue, sourceValue],
          resolved: sourceValue, // 默认使用源值
          resolution: 'prioritized',
        };
        conflicts.push(conflict);
      }
    }
  }
  
  return conflicts;
}

/**
 * 合并对象
 */
function mergeObjects<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  options: {
    overrideArrays: boolean;
    mergeArrays: boolean;
    conflicts: ConfigConflict[];
    resolveConflicts: (conflict: ConfigConflict) => any;
  }
): void {
  const { overrideArrays, mergeArrays, conflicts, resolveConflicts } = options;
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const targetValue = target[key];
      const sourceValue = source[key];
      
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        if (mergeArrays) {
          target[key] = mergeArraysByKey(targetValue, sourceValue) as T[typeof key];
        } else if (overrideArrays) {
          target[key] = [...sourceValue] as T[typeof key];
        }
      } else if (
        typeof targetValue === 'object' && 
        typeof sourceValue === 'object' && 
        targetValue !== null && 
        sourceValue !== null &&
        !Array.isArray(targetValue) && 
        !Array.isArray(sourceValue)
      ) {
        mergeObjects(targetValue, sourceValue, options);
      } else {
        // 处理冲突
        const conflict = conflicts.find(c => c.path === key);
        if (conflict) {
          conflict.resolved = resolveConflicts(conflict);
          target[key] = conflict.resolved as T[typeof key];
        } else {
          target[key] = sourceValue as T[typeof key];
        }
      }
    }
  }
}

/**
 * 基于键合并数组
 */
function mergeArraysByKey<T extends Record<string, any>>(
  targetArray: T[],
  sourceArray: Partial<T>[]
): T[] {
  const result = [...targetArray];
  const keyFields = ['id', 'name', 'key'];
  
  for (const sourceItem of sourceArray) {
    const existingIndex = findArrayIndex(result, sourceItem, keyFields);
    
    if (existingIndex !== -1) {
      // 合并现有项
      result[existingIndex] = deepMerge(result[existingIndex], sourceItem);
    } else {
      // 添加新项
      result.push(sourceItem as T);
    }
  }
  
  return result;
}

/**
 * 查找数组项索引
 */
function findArrayIndex<T extends Record<string, any>>(
  array: T[],
  item: Partial<T>,
  keyFields: string[]
): number {
  for (const keyField of keyFields) {
    if (item[keyField] !== undefined) {
      const index = array.findIndex(i => i[keyField] === item[keyField]);
      if (index !== -1) {
        return index;
      }
    }
  }
  
  return -1;
}

/**
 * 默认冲突解决器
 */
function defaultConflictResolver(conflict: ConfigConflict): any {
  // 默认使用第二个值（优先级更高的值）
  return conflict.values[1];
}

/**
 * 检查两个值是否相等
 */
export function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a === null || b === null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => isEqual(a[key], b[key]));
  }
  
  return false;
}

/**
 * 获取配置值路径
 */
export function getConfigValue(config: any, path: string): any {
  return path.split('.').reduce((obj, key) => {
    return obj && obj[key] !== undefined ? obj[key] : undefined;
  }, config);
}

/**
 * 设置配置值路径
 */
export function setConfigValue(config: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * 删除配置值路径
 */
export function deleteConfigValue(config: any, path: string): boolean {
  const keys = path.split('.');
  let current = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      return false;
    }
    current = current[key];
  }
  
  const lastKey = keys[keys.length - 1];
  if (lastKey in current) {
    delete current[lastKey];
    return true;
  }
  
  return false;
}

/**
 * 扁平化配置对象
 */
export function flattenConfig(config: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      const value = config[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, flattenConfig(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }
  
  return result;
}

/**
 * 展开扁平化配置
 */
export function unflattenConfig(flatConfig: Record<string, any>): any {
  const result: any = {};
  
  for (const key in flatConfig) {
    if (flatConfig.hasOwnProperty(key)) {
      setConfigValue(result, key, flatConfig[key]);
    }
  }
  
  return result;
}

/**
 * 验证配置结构
 */
export function validateConfigStructure(
  config: any,
  requiredPaths: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const path of requiredPaths) {
    const value = getConfigValue(config, path);
    if (value === undefined || value === null || value === '') {
      missing.push(path);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 克隆配置对象
 */
export function cloneConfig<T>(config: T): T {
  if (config === null || typeof config !== 'object') {
    return config;
  }
  
  if (Array.isArray(config)) {
    return config.map(item => cloneConfig(item)) as T;
  }
  
  const result: any = {};
  for (const key in config) {
    if (config.hasOwnProperty(key)) {
      result[key] = cloneConfig(config[key]);
    }
  }
  
  return result;
}