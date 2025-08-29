/**
 * Configuration Context for React Components
 * 提供配置系统上下文和全局配置访问
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ConfigurationManager } from '@blade-ai/core';
import { BladeUnifiedConfig, ConfigState } from '@blade-ai/core';

/**
 * 配置上下文接口
 */
export interface ConfigContextType {
  config: BladeUnifiedConfig | null;
  state: ConfigState;
  manager: ConfigurationManager | null;
  isInitialized: boolean;
  error: Error | null;
  
  // 操作方法
  initialize: () => Promise<void>;
  updateConfig: (updates: Partial<BladeUnifiedConfig>) => Promise<void>;
  reloadConfig: () => Promise<void>;
}

/**
 * 默认配置上下文值
 */
const defaultConfigContext: ConfigContextType = {
  config: null,
  state: {
    isValid: false,
    errors: [],
    warnings: [],
    lastReload: '',
    configVersion: '',
    loadedLayers: [],
    configHash: '',
  },
  manager: null,
  isInitialized: false,
  error: null,
  initialize: async () => {},
  updateConfig: async () => {},
  reloadConfig: async () => {},
};

/**
 * 配置上下文
 */
export const ConfigContext = createContext<ConfigContextType>(defaultConfigContext);

/**
 * 配置上下文提供者属性
 */
export interface ConfigProviderProps {
  children: React.ReactNode;
  manager?: ConfigurationManager;
  autoInitialize?: boolean;
  onError?: (error: Error) => void;
}

/**
 * 配置上下文提供者
 */
export function ConfigProvider({ 
  children, 
  manager: providedManager,
  autoInitialize = true,
  onError 
}: ConfigProviderProps) {
  const [manager] = useState<ConfigurationManager>(
    providedManager || new ConfigurationManager()
  );
  const [config, setConfig] = useState<BladeUnifiedConfig | null>(null);
  const [state, setState] = useState<ConfigState>(defaultConfigContext.state);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 错误处理
  const handleError = (err: Error) => {
    setError(err);
    if (onError) {
      onError(err);
    } else {
      console.error('配置上下文错误:', err);
    }
  };

  // 初始化配置管理器
  const initialize = async () => {
    try {
      const loadedConfig = await manager.initialize();
      setConfig(loadedConfig);
      setState(manager.getState());
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      handleError(err as Error);
      setIsInitialized(true);
    }
  };

  // 更新配置
  const updateConfig = async (updates: Partial<BladeUnifiedConfig>) => {
    try {
      await manager.updateConfig(updates);
      setConfig(manager.getConfig());
      setState(manager.getState());
    } catch (err) {
      handleError(err as Error);
      throw err;
    }
  };

  // 重新加载配置
  const reloadConfig = async () => {
    try {
      const reloadedConfig = await manager.reload();
      setConfig(reloadedConfig);
      setState(manager.getState());
    } catch (err) {
      handleError(err as Error);
    }
  };

  // 自动初始化
  useEffect(() => {
    if (autoInitialize && !isInitialized) {
      initialize();
    }
  }, [autoInitialize, isInitialized]);

  // 监听配置变更
  useEffect(() => {
    const handleConfigChange = () => {
      setConfig(manager.getConfig());
      setState(manager.getState());
    };

    manager.on('configLoaded', handleConfigChange);
    manager.on('configChanged', handleConfigChange);

    return () => {
      manager.off('configLoaded', handleConfigChange);
      manager.off('configChanged', handleConfigChange);
    };
  }, [manager]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (manager) {
        manager.destroy();
      }
    };
  }, [manager]);

  const contextValue: ConfigContextType = {
    config,
    state,
    manager,
    isInitialized,
    error,
    initialize,
    updateConfig,
    reloadConfig,
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * 使用配置上下文的 Hook
 */
export function useConfigContext() {
  const context = useContext(ConfigContext);
  
  if (context === undefined) {
    throw new Error('useConfigContext must be used within a ConfigProvider');
  }
  
  return context;
}

/**
 * 高阶组件：注入配置上下文
 */
export function withConfig<T>(
  Component: React.ComponentType<T>
): React.ComponentType<Omit<T, keyof ConfigContextType>> {
  const WithConfig = (props: Omit<T, keyof ConfigContextType>) => {
    const configContext = useConfigContext();
    
    return <Component {...(props as T)} {...configContext} />;
  };
  
  WithConfig.displayName = `WithConfig(${Component.displayName || Component.name})`;
  return WithConfig;
}