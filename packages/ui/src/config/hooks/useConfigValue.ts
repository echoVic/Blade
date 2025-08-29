/**
 * React Hook for accessing specific configuration values
 * 提供细粒度的配置值访问和响应式更新
 */

import { useState, useEffect, useCallback } from 'react';
import { useConfig } from './useConfig.js';
import { BladeUnifiedConfig } from '@blade-ai/core';

/**
 * 使用配置值的 Hook 返回类型
 */
export interface UseConfigValueReturn<T = any> {
  value: T;
  setValue: (value: T) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  update: (updater: (currentValue: T) => T) => Promise<void>;
  reset: () => Promise<void>;
}

/**
 * 使用配置值的 Hook 选项
 */
export interface UseConfigValueOptions {
  defaultValue?: any;
  enableHotReload?: boolean;
  validateOnChange?: boolean;
  transform?: (value: any) => T;
  debounceMs?: number;
}

/**
 * 使用配置值的 React Hook
 * 
 * @param path 配置路径，如 'auth.apiKey' 或 'ui.theme'
 * @param options 选项参数
 */
export function useConfigValue<T = any>(
  path: string,
  options: UseConfigValueOptions = {}
): UseConfigValueReturn<T> {
  const {
    defaultValue,
    enableHotReload = true,
    validateOnChange = true,
    transform,
    debounceMs = 0,
  } = options;

  const { getConfigValue, setConfigValue, config, isLoading, error } = useConfig();
  const [localValue, setLocalValue] = useState<T>(() => {
    const initialValue = getConfigValue(path);
    return initialValue !== undefined ? initialValue : defaultValue;
  });
  const [localError, setLocalError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 获取值并应用转换
  const getTransformedValue = useCallback((rawValue: any): T => {
    if (transform) {
      try {
        return transform(rawValue);
      } catch (err) {
        console.error(`配置值转换失败 (${path}):`, err);
        return rawValue;
      }
    }
    return rawValue as T;
  }, [path, transform]);

  // 当配置变化时更新本地值
  useEffect(() => {
    if (config) {
      const rawValue = getConfigValue(path);
      const newValue = getTransformedValue(rawValue);
      setLocalValue(newValue);
    }
  }, [config, path, getConfigValue, getTransformedValue]);

  // 防抖更新
  const debounceUpdate = useCallback((func: () => Promise<void>) => {
    if (debounceMs <= 0) {
      return func();
    }

    let timeoutId: NodeJS.Timeout;
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          await func();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, debounceMs);
    });
  }, [debounceMs]);

  // 设置配置值
  const setValue = useCallback(async (newValue: T) => {
    setIsUpdating(true);
    setLocalError(null);

    try {
      await setConfigValue(path, newValue);
      setLocalValue(newValue);
    } catch (err) {
      setLocalError(err as Error);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [path, setConfigValue]);

  // 通过 updater 函数更新值
  const update = useCallback(async (updater: (currentValue: T) => T) => {
    const currentValue = localValue;
    try {
      const newValue = updater(currentValue);
      await setValue(newValue);
    } catch (err) {
      setLocalError(err as Error);
      throw err;
    }
  }, [localValue, setValue]);

  // 重置为默认值
  const reset = useCallback(async () => {
    if (defaultValue !== undefined) {
      await setValue(defaultValue);
    } else {
      // 移除该配置项
      try {
        await setConfigValue(path, undefined);
        setLocalValue(defaultValue);
      } catch (err) {
        setLocalError(err as Error);
        throw err;
      }
    }
  }, [path, defaultValue, setValue, setConfigValue]);

  return {
    value: localValue,
    setValue,
    isLoading: isLoading || isUpdating,
    error: error || localError,
    update,
    reset,
  };
}

/**
 * 使用多个配置值的 Hook
 */
export function useConfigValues<T extends Record<string, any>>(
  paths: Record<string, string>,
  options: UseConfigValueOptions = {}
): {
  values: T;
  setValues: (updates: Partial<T>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  reset: (keys?: string[]) => Promise<void>;
} {
  const { setConfigValue, config, isLoading, error } = useConfig();
  const [values, setValues] = useState<T>({} as T);
  const [localError, setLocalError] = useState<Error | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // 初始化值
  useEffect(() => {
    if (config) {
      const newValues: T = {} as T;
      for (const [key, path] of Object.entries(paths)) {
        newValues[key] = getConfigValue(path);
      }
      setValues(newValues);
    }
  }, [config, paths]);

  // 设置多个值
  const setValues = useCallback(async (updates: Partial<T>) => {
    setIsUpdating(true);
    setLocalError(null);

    try {
      const updatePromises = Object.entries(updates).map(async ([key, value]) => {
        if (paths[key]) {
          await setConfigValue(paths[key], value);
        }
      });

      await Promise.all(updatePromises);

      // 更新本地状态
      setValues(prev => ({ ...prev, ...updates }));
    } catch (err) {
      setLocalError(err as Error);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [paths, setConfigValue]);

  // 重置指定的值
  const reset = useCallback(async (keys?: string[]) => {
    const keysToReset = keys || Object.keys(paths);
    const resetPromises = keysToReset.map(async (key) => {
      if (paths[key]) {
        await setConfigValue(paths[key], undefined);
      }
    });

    try {
      await Promise.all(resetPromises);
      
      // 更新本地状态
      const newValues = { ...values };
      keysToReset.forEach(key => {
        delete newValues[key];
      });
      setValues(newValues);
    } catch (err) {
      setLocalError(err as Error);
      throw err;
    }
  }, [paths, setConfigValue, values]);

  return {
    values,
    setValues,
    isLoading: isLoading || isUpdating,
    error: error || localError,
    reset,
  };
}

/**
 * 使用配置监听的 Hook
 */
export function useConfigListener(
  eventType: string,
  callback: (event: any) => void,
  deps: any[] = []
) {
  const { subscribe } = useConfig();

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === eventType) {
        callback(event);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe, eventType, callback, ...deps]);
}

/**
 * 使用配置验证的 Hook
 */
export function useConfigValidation<T = any>(
  path: string,
  validator: (value: T) => { valid: boolean; errors: string[] }
) {
  const { value } = useConfigValue<T>(path);
  const [validation, setValidation] = useState(() => validator(value));

  useEffect(() => {
    setValidation(validator(value));
  }, [value, validator]);

  return {
    value,
    isValid: validation.valid,
    errors: validation.errors,
  };
}