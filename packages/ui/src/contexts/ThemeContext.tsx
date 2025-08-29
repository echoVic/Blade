/**
 * 主题上下文
 * 提供主题状态管理和访问接口
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { 
  ThemeConfig, 
  ThemeMode, 
  ThemeVariant,
  ThemeEvent 
} from '../types/theme-engine';
import type { 
  ThemeContextValue, 
  ThemeProviderProps,
  ThemeConsumerProps,
  ThemeHookOptions 
} from '../types/theme-hooks';
import { ThemeEngine } from '../core/theme-engine';
import { ThemeValidator } from '../core/theme-validator';

// 创建主题上下文
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// 默认主题选项
const DEFAULT_THEME_OPTIONS: ThemeHookOptions = {
  syncWithSystem: true,
  persistTheme: true,
  enableTransition: true,
  defaultTheme: 'default',
  defaultMode: 'light',
};

/**
 * 主题提供者组件
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  initialMode,
  options = DEFAULT_THEME_OPTIONS,
  customThemes = [],
  onThemeEvent,
}) => {
  const [theme, setThemeState] = useState<ThemeConfig | null>(null);
  const [mode, setModeState] = useState<keyof ThemeMode>(initialMode || options.defaultMode || 'light');
  const [variant, setVariantState] = useState<ThemeVariant | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [themeEngine, setThemeEngine] = useState<ThemeEngine | null>(null);
  const [eventListeners, setEventListeners] = useState<Array<{
    event: ThemeEvent['type'];
    handler: (event: ThemeEvent) => void;
  }>>([]);

  // 初始化主题引擎
  useEffect(() => {
    const initThemeEngine = async () => {
      try {
        setIsLoading(true);
        
        const engine = new ThemeEngine({
          config: {
            defaultTheme: initialTheme || options.defaultTheme,
            defaultMode: initialMode || options.defaultMode,
            enableCSSVariables: options.enableTransition,
            enableHotReload: options.syncWithSystem,
            debug: process.env.NODE_ENV === 'development',
          },
        });

        // 添加自定义主题
        for (const customTheme of customThemes) {
          await engine.addTheme(customTheme);
        }

        // 事件监听
        const handleThemeEvent = (event: ThemeEvent) => {
          if (onThemeEvent) {
            onThemeEvent(event);
          }
          
          // 触发特定事件的回调
          switch (event.type) {
            case 'theme:changed':
              if (event.data?.newTheme) {
                setThemeState(engine.getCurrentTheme());
              }
              if (event.data?.newMode) {
                setModeState(event.data.newMode);
              }
              break;
            case 'theme:variant:applied':
              setVariantState(engine.getCurrentVariant() || undefined);
              break;
          }
        };

        engine.on('theme:changed', handleThemeEvent);
        engine.on('theme:variant:applied', handleThemeEvent);
        engine.on('theme:token:accessed', handleThemeEvent);

        await engine.initialize();
        
        setThemeEngine(engine);
        setThemeState(engine.getCurrentTheme());
        setModeState(engine.getCurrentMode() as keyof ThemeMode);
        setVariantState(engine.getCurrentVariant() || undefined);
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize theme engine'));
        setIsLoading(false);
      }
    };

    initThemeEngine();

    return () => {
      if (themeEngine) {
        themeEngine.destroy();
      }
    };
  }, [initialTheme, initialMode, options, customThemes, onThemeEvent]);

  // 设置主题
  const setTheme = useCallback(async (themeId: string) => {
    if (!themeEngine) return;
    
    try {
      await themeEngine.setTheme(themeId, { mode });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set theme'));
    }
  }, [themeEngine, mode]);

  // 设置模式
  const setMode = useCallback(async (newMode: keyof ThemeMode) => {
    if (!themeEngine || !theme) return;
    
    try {
      await themeEngine.setTheme(theme.id, { mode: newMode });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set mode'));
    }
  }, [themeEngine, theme]);

  // 设置变体
  const setVariant = useCallback(async (variantId: string) => {
    if (!themeEngine) return;
    
    try {
      await themeEngine.applyVariant(variantId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to apply variant'));
    }
  }, [themeEngine]);

  // 获取令牌值
  const getToken = useCallback((path: string) => {
    if (!themeEngine) return undefined;
    
    try {
      return themeEngine.getToken(path);
    } catch (err) {
      console.warn(`Failed to get token at path: ${path}`, err);
      return undefined;
    }
  }, [themeEngine]);

  // 获取样式
  const getStyles = useCallback(<T extends Record<string, any>>(
    callback: (theme: ThemeConfig) => T
  ): T => {
    if (!theme) return {} as T;
    
    try {
      return callback(theme);
    } catch (err) {
      console.warn('Failed to generate styles', err);
      return {} as T;
    }
  }, [theme]);

  // 添加事件监听器
  const addEventListener = useCallback((
    event: ThemeEvent['type'], 
    handler: (event: ThemeEvent) => void
  ) => {
    setEventListeners(prev => [...prev, { event, handler }]);
  }, []);

  // 移除事件监听器
  const removeEventListener = useCallback((
    event: ThemeEvent['type'], 
    handler: (event: ThemeEvent) => void
  ) => {
    setEventListeners(prev => prev.filter(
      listener => listener.event !== event || listener.handler !== handler
    ));
  }, []);

  // 主题上下文值
  const contextValue = useMemo<ThemeContextValue>(() => ({
    theme: theme!,
    mode,
    variant,
    setTheme,
    setMode,
    setVariant,
    getToken,
    getStyles,
    addEventListener,
    removeEventListener,
    contextChain: [],
    options,
  }), [
    theme, 
    mode, 
    variant, 
    setTheme, 
    setMode, 
    setVariant, 
    getToken, 
    getStyles, 
    addEventListener, 
    removeEventListener,
    options
  ]);

  // 渲染加载状态
  if (isLoading) {
    return <div data-testid="theme-provider-loading">Loading theme...</div>;
  }

  // 渲染错误状态
  if (error) {
    return <div data-testid="theme-provider-error">Error: {error.message}</div>;
  }

  // 渲染主题上下文提供者
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * 使用主题上下文钩子
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

/**
 * 主题消费者组件
 */
export const ThemeConsumer: React.FC<ThemeConsumerProps> = ({ 
  children, 
  options 
}) => {
  const themeContext = useTheme();
  
  return (
    <>
      {children(themeContext)}
    </>
  );
};

/**
 * 使用主题令牌钩子
 */
export const useToken = <T = any>(path: string): T | undefined => {
  const { getToken } = useTheme();
  return getToken(path) as T;
};

/**
 * 使用主题样式钩子
 */
export const useStyles = <T extends Record<string, any>>(
  callback: (theme: ThemeConfig) => T,
  deps: React.DependencyList = []
): T => {
  const { getStyles } = useTheme();
  return useMemo(() => getStyles(callback), [getStyles, ...deps]);
};

/**
 * 使用主题模式钩子
 */
export const useThemeMode = (): [
  keyof ThemeMode, 
  (mode: keyof ThemeMode) => void
] => {
  const { mode, setMode } = useTheme();
  return [mode, setMode];
};

/**
 * 使用主题切换钩子
 */
export const useThemeSwitcher = (): [
  string, 
  (themeId: string) => void
] => {
  const { theme, setTheme } = useTheme();
  return [theme?.id || '', setTheme];
};

/**
 * 使用主题变体钩子
 */
export const useThemeVariant = (): [
  ThemeVariant | undefined, 
  (variantId: string) => void
] => {
  const { variant, setVariant } = useTheme();
  return [variant, setVariant];
};

/**
 * 使用主题事件钩子
 */
export const useThemeEvent = (
  event: ThemeEvent['type'], 
  handler: (event: ThemeEvent) => void
): void => {
  const { addEventListener, removeEventListener } = useTheme();
  
  useEffect(() => {
    addEventListener(event, handler);
    return () => removeEventListener(event, handler);
  }, [event, handler, addEventListener, removeEventListener]);
};

/**
 * 使用主题验证钩子
 */
export const useThemeValidation = (theme: ThemeConfig): boolean => {
  return useMemo(() => {
    try {
      const validator = new ThemeValidator({
        validationLevel: 'normal',
        debug: false,
      } as any);
      
      const result = validator.validateTheme(theme);
      return result.isValid;
    } catch (err) {
      console.warn('Theme validation failed:', err);
      return false;
    }
  }, [theme]);
};

/**
 * 使用主题性能钩子
 */
export const useThemePerformance = () => {
  const { getToken } = useTheme();
  
  return useMemo(() => ({
    // 获取性能指标
    getMetrics: () => {
      // 实现性能指标获取逻辑
      return {};
    },
    
    // 重置性能指标
    resetMetrics: () => {
      // 实现性能指标重置逻辑
    },
    
    // 优化主题性能
    optimize: () => {
      // 实现性能优化逻辑
    },
  }), [getToken]);
};

export default ThemeContext;