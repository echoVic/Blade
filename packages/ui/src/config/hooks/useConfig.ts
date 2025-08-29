/**
 * React Hook for Configuration Management
 * 提供响应式配置状态和管理功能
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BladeUnifiedConfig, 
  ConfigState, 
  ConfigEvent, 
  ConfigEventType 
} from '@blade-ai/core';
import { ConfigContext } from '../../contexts/ConfigContext.js';

/**
 * 配置 Hook 类型定义
 */
export interface UseConfigReturn {
  config: BladeUnifiedConfig | null;
  configState: ConfigState;
  isLoading: boolean;
  error: Error | null;
  
  // 配置操作
  updateConfig: (updates: Partial<BladeUnifiedConfig>) => Promise<void>;
  reloadConfig: () => Promise<void>;
  getConfigValue: (path: string) => any;
  setConfigValue: (path: string, value: any) => Promise<void>;
  
  // 订阅功能
  subscribe: (callback: (event: ConfigEvent) => void) => () => void;
  
  // 工具方法
  resetConfig: () => Promise<void>;
  exportConfig: () => string;
  importConfig: (configData: string) => Promise<void>;
}

/**
 * 配置 Hook 选项
 */
export interface UseConfigOptions {
  autoLoad?: boolean;
  autoReload?: boolean;
  errorHandler?: (error: Error) => void;
  normalizeConfig?: boolean;
}

/**
 * 使用配置的 React Hook
 */
export function useConfig(options: UseConfigOptions = {}): UseConfigReturn {
  const {
    autoLoad = true,
    autoReload = false,
    errorHandler,
    normalizeConfig = true,
  } = options;
  
  const context = React.useContext(ConfigContext);
  const [config, setConfig] = useState<BladeUnifiedConfig | null>(context.config);
  const [configState, setConfigState] = useState<ConfigState>(context.state);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const subscriptions = useRef<Set<Function>>(new Set());
  const managerRef = useRef(context.manager);
  
  // 错误处理
  const handleError = useCallback((err: Error) => {
    setError(err);
    if (errorHandler) {
      errorHandler(err);
    } else {
      console.error('配置错误:', err);
    }
  }, [errorHandler]);
  
  // 加载配置
  const loadConfig = useCallback(async () => {
    if (!managerRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedConfig = await managerRef.current.initialize();
      setConfig(loadedConfig);
      setConfigState(managerRef.current.getState());
    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);
  
  // 重新加载配置
  const reloadConfig = useCallback(async () => {
    if (!managerRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const reloadedConfig = await managerRef.current.reload();
      setConfig(reloadedConfig);
      setConfigState(managerRef.current.getState());
    } catch (err) {
      handleError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);
  
  // 更新配置
  const updateConfig = useCallback(async (updates: Partial<BladeUnifiedConfig>) => {
    if (!managerRef.current || !config) {
      handleError(new Error('配置管理器未初始化'));
      return;
    }
    
    try {
      await managerRef.current.updateConfig(updates);
      const updatedConfig = managerRef.current.getConfig();
      setConfig(updatedConfig);
      setConfigState(managerRef.current.getState());
    } catch (err) {
      handleError(err as Error);
      throw err;
    }
  }, [config, handleError]);
  
  // 获取配置值
  const getConfigValue = useCallback((path: string) => {
    if (!config) return undefined;
    
    return path.split('.').reduce((obj: any, key: string) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, config);
  }, [config]);
  
  // 设置配置值
  const setConfigValue = useCallback(async (path: string, value: any) => {
    if (!config) {
      handleError(new Error('配置未加载'));
      return;
    }
    
    const updates: any = {};
    const keys = path.split('.');
    let current = updates;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    await updateConfig(updates);
  }, [config, updateConfig, handleError]);
  
  // 重置配置
  const resetConfig = useCallback(async () => {
    if (!managerRef.current) {
      handleError(new Error('配置管理器未初始化'));
      return;
    }
    
    try {
      // 这里需要实现重置逻辑
      await reloadConfig();
    } catch (err) {
      handleError(err as Error);
    }
  }, [reloadConfig, handleError]);
  
  // 导出配置
  const exportConfig = useCallback(() => {
    if (!config) {
      handleError(new Error('配置未加载'));
      return '';
    }
    
    try {
      return JSON.stringify(config, null, 2);
    } catch (err) {
      handleError(err as Error);
      return '';
    }
  }, [config, handleError]);
  
  // 导入配置
  const importConfig = useCallback(async (configData: string) => {
    try {
      const importedConfig = JSON.parse(configData);
      await updateConfig(importedConfig);
    } catch (err) {
      handleError(new Error('配置导入失败: 无效的配置数据'));
      throw err;
    }
  }, [updateConfig, handleError]);
  
  // 订阅配置事件
  const subscribe = useCallback((callback: (event: ConfigEvent) => void) => {
    if (!managerRef.current) return () => {};
    
    return managerRef.current.subscribe(callback);
  }, []);
  
  // 处理配置变更事件
  useEffect(() => {
    if (!managerRef.current) return;
    
    const handleConfigEvent = (event: ConfigEvent) => {
      switch (event.type) {
        case ConfigEventType.CHANGED:
        case ConfigEventType.RELOADED:
          if (managerRef.current) {
            setConfig(managerRef.current.getConfig());
            setConfigState(managerRef.current.getState());
          }
          break;
        case ConfigEventType.ERROR:
          handleError(event.error || new Error('未知配置错误'));
          break;
      }
      
      // 通知订阅者
      subscriptions.current.forEach(cb => cb(event));
    };
    
    const unsubscribe = managerRef.current.subscribe(handleConfigEvent);
    
    return () => {
      unsubscribe();
    };
  }, [handleError]);
  
  // 自动加载配置
  useEffect(() => {
    if (autoLoad && managerRef.current && !config) {
      loadConfig();
    }
  }, [autoLoad, config, loadConfig]);
  
  // 启用热重载
  useEffect(() => {
    if (autoReload && managerRef.current) {
      managerRef.current.enable();
    }
    
    return () => {
      if (autoReload && managerRef.current) {
        managerRef.current.disable();
      }
    };
  }, [autoReload]);
  
  // 监听上下文变化
  useEffect(() => {
    setConfig(context.config);
    setConfigState(context.state);
    managerRef.current = context.manager;
  }, [context]);
  
  return {
    config,
    configState,
    isLoading,
    error,
    updateConfig,
    reloadConfig,
    getConfigValue,
    setConfigValue,
    subscribe,
    resetConfig,
    exportConfig,
    importConfig,
  };
}