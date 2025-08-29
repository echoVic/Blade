/**
 * 主题相关hooks集合
 * 提供主题管理、令牌访问和样式生成等功能
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { 
  ThemeConfig, 
  ThemeMode, 
  ThemeVariant,
  ThemeEvent 
} from '../types/theme-engine';
import type { 
  ThemeHookOptions,
  ThemeStyleOptions,
  ThemeVariantOptions,
  ThemeComponentOptions,
  ThemeResponsiveConfig,
  ThemeAccessibilityConfig 
} from '../types/theme-hooks';
import { useTheme as useThemeContext } from '../contexts/ThemeContext';

/**
 * 使用主题配置hook
 */
export const useThemeConfig = (options?: ThemeHookOptions) => {
  const themeContext = useThemeContext();
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>('light');
  
  // 监听系统主题变化
  useEffect(() => {
    if (!options?.syncWithSystem) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light');
    };
    
    setSystemMode(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [options?.syncWithSystem]);
  
  // 确定实际使用的模式
  const effectiveMode = useMemo(() => {
    if (options?.syncWithSystem) {
      return systemMode;
    }
    return themeContext.mode;
  }, [themeContext.mode, systemMode, options?.syncWithSystem]);
  
  return {
    ...themeContext,
    effectiveMode,
    systemMode,
  };
};

/**
 * 使用主题样式hook
 */
export const useThemeStyles = <T extends Record<string, any>>(
  options: ThemeStyleOptions<T>
) => {
  const { theme } = useThemeContext();
  const { styles, condition, deps = [], memoize = true } = options;
  
  const computedStyles = useMemo(() => {
    // 条件检查
    if (condition && !condition(theme)) {
      return {} as T;
    }
    
    try {
      return styles(theme);
    } catch (error) {
      console.warn('Failed to compute theme styles:', error);
      return {} as T;
    }
  }, [theme, styles, condition, ...deps]);
  
  return memoize ? computedStyles : styles(theme);
};

/**
 * 使用主题变体hook
 */
export const useThemeVariants = <T extends Record<string, any>>(
  options: ThemeVariantOptions[]
) => {
  const { theme, variant } = useThemeContext();
  const [activeVariants, setActiveVariants] = useState<ThemeVariantOptions[]>([]);
  
  useEffect(() => {
    const matchingVariants = options.filter(option => 
      option.condition ? option.condition(theme) : true
    ).sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    setActiveVariants(matchingVariants);
  }, [theme, options]);
  
  const variantStyles = useMemo(() => {
    return activeVariants.reduce((acc, variantOption) => {
      return { ...acc, ...variantOption.tokens };
    }, {} as T);
  }, [activeVariants]);
  
  return {
    variants: activeVariants,
    styles: variantStyles,
    activeVariant: variant,
  };
};

/**
 * 使用主题组件hook
 */
export const useThemeComponent = <T extends Record<string, any>>(
  options: ThemeComponentOptions
) => {
  const { theme } = useThemeContext();
  const { componentName, defaultVariant, variants = [], customStyles, responsive = false } = options;
  
  // 获取组件主题配置
  const componentTheme = useMemo(() => {
    return theme.components?.[componentName] || {};
  }, [theme, componentName]);
  
  // 获取默认变体样式
  const defaultVariantStyles = useMemo(() => {
    const variant = variants.find(v => v.name === defaultVariant);
    return variant?.tokens || {};
  }, [variants, defaultVariant]);
  
  // 生成组件样式
  const componentStyles = useMemo(() => {
    const baseStyles = componentTheme.style || {};
    const customStyleResult = customStyles ? customStyles(theme, {}) : {};
    
    return {
      ...defaultVariantStyles,
      ...baseStyles,
      ...customStyleResult,
    } as T;
  }, [componentTheme, defaultVariantStyles, customStyles, theme]);
  
  // 响应式处理
  const responsiveStyles = useResponsiveStyles(componentStyles, responsive);
  
  return {
    styles: responsive ? responsiveStyles : componentStyles,
    theme: componentTheme,
    variants,
    defaultVariant,
  };
};

/**
 * 使用响应式样式hook
 */
export const useResponsiveStyles = <T extends Record<string, any>>(
  styles: T, 
  enabled: boolean = true
) => {
  const [breakpoint, setBreakpoint] = useState<string>('md');
  const responsiveConfigRef = useRef<ThemeResponsiveConfig>();
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleResize = () => {
      const width = window.innerWidth;
      let currentBreakpoint = 'xs';
      
      if (responsiveConfigRef.current) {
        const breakpoints = responsiveConfigRef.current.breakpoints;
        if (width >= breakpoints.xl) currentBreakpoint = 'xl';
        else if (width >= breakpoints.lg) currentBreakpoint = 'lg';
        else if (width >= breakpoints.md) currentBreakpoint = 'md';
        else if (width >= breakpoints.sm) currentBreakpoint = 'sm';
      } else {
        // 默认断点
        if (width >= 1280) currentBreakpoint = 'xl';
        else if (width >= 1024) currentBreakpoint = 'lg';
        else if (width >= 768) currentBreakpoint = 'md';
        else if (width >= 640) currentBreakpoint = 'sm';
      }
      
      setBreakpoint(currentBreakpoint);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [enabled]);
  
  return useMemo(() => {
    if (!enabled) return styles;
    
    // 这里可以实现更复杂的响应式样式处理
    return {
      ...styles,
      [`@media (min-width: ${breakpoint})`]: styles,
    } as T;
  }, [styles, enabled, breakpoint]);
};

/**
 * 使用主题动画hook
 */
export const useThemeAnimation = <T extends Record<string, any>>(
  animationKey: string,
  enabled: boolean = true
) => {
  const { theme } = useThemeContext();
  
  const animationStyles = useMemo(() => {
    if (!enabled) return {} as T;
    
    // 从主题中获取动画配置
    const animationConfig = theme.tokens.animation;
    
    // 返回动画样式
    return {
      transition: `all ${animationConfig.duration.fast}ms ${animationConfig.easing.easeInOut}`,
      animationTimingFunction: animationConfig.easing.easeInOut,
    } as T;
  }, [theme, animationKey, enabled]);
  
  return animationStyles;
};

/**
 * 使用主题无障碍hook
 */
export const useThemeAccessibility = (config?: ThemeAccessibilityConfig) => {
  const { theme } = useThemeContext();
  const [highContrast, setHighContrast] = useState(false);
  
  // 高对比度模式切换
  const toggleHighContrast = useCallback(() => {
    setHighContrast(prev => !prev);
  }, []);
  
  // 无障碍样式
  const accessibilityStyles = useMemo(() => {
    const styles: Record<string, any> = {};
    
    if (highContrast || config?.highContrast) {
      // 应用高对比度样式
      styles['--high-contrast'] = 'true';
    }
    
    if (config?.screenReaderSupport) {
      // 应用屏幕阅读器支持样式
      styles['.sr-only'] = {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: '0',
      };
    }
    
    return styles;
  }, [highContrast, config]);
  
  return {
    highContrast,
    toggleHighContrast,
    styles: accessibilityStyles,
    themeContrast: theme.tokens.colors.theme,
  };
};

/**
 * 使用主题性能hook
 */
export const useThemePerformance = () => {
  const { getToken } = useThemeContext();
  const [metrics, setMetrics] = useState({
    cacheHitRate: 1,
    tokenResolveTime: 0,
    themeSwitchTime: 0,
  });
  
  // 性能监控
  const monitorPerformance = useCallback(() => {
    // 实现性能监控逻辑
    const startTime = performance.now();
    
    // 模拟令牌访问
    getToken('colors.base.white');
    
    const endTime = performance.now();
    
    setMetrics(prev => ({
      ...prev,
      tokenResolveTime: endTime - startTime,
    }));
  }, [getToken]);
  
  // 优化主题访问
  const optimizeThemeAccess = useCallback(() => {
    // 实现主题访问优化
  }, []);
  
  return {
    metrics,
    monitorPerformance,
    optimizeThemeAccess,
  };
};

/**
 * 使用主题存储hook
 */
export const useThemeStorage = (persist: boolean = true) => {
  const [storedTheme, setStoredTheme] = useState<string | null>(null);
  
  // 加载存储的主题
  useEffect(() => {
    if (!persist) return;
    
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme) {
      setStoredTheme(savedTheme);
    }
  }, [persist]);
  
  // 保存主题偏好
  const saveThemePreference = useCallback((themeId: string) => {
    if (!persist) return;
    
    localStorage.setItem('theme-preference', themeId);
    setStoredTheme(themeId);
  }, [persist]);
  
  // 清除主题偏好
  const clearThemePreference = useCallback(() => {
    if (!persist) return;
    
    localStorage.removeItem('theme-preference');
    setStoredTheme(null);
  }, [persist]);
  
  return {
    storedTheme,
    saveThemePreference,
    clearThemePreference,
  };
};

/**
 * 使用主题事件hook
 */
export const useThemeEvents = () => {
  const { addEventListener, removeEventListener } = useThemeContext();
  const [events, setEvents] = useState<ThemeEvent[]>([]);
  
  // 添加事件监听器
  const on = useCallback((
    eventType: ThemeEvent['type'], 
    handler: (event: ThemeEvent) => void
  ) => {
    addEventListener(eventType, handler);
  }, [addEventListener]);
  
  // 移除事件监听器
  const off = useCallback((
    eventType: ThemeEvent['type'], 
    handler: (event: ThemeEvent) => void
  ) => {
    removeEventListener(eventType, handler);
  }, [removeEventListener]);
  
  // 记录事件
  const recordEvent = useCallback((event: ThemeEvent) => {
    setEvents(prev => [...prev.slice(-100), event]); // 保持最近100个事件
  }, []);
  
  return {
    events,
    on,
    off,
    record: recordEvent,
  };
};

/**
 * 使用主题开发工具hook
 */
export const useThemeDevTools = (enabled: boolean = false) => {
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  
  // 切换开发工具
  const toggleDevTools = useCallback(() => {
    if (!enabled) return;
    setDevToolsOpen(prev => !prev);
  }, [enabled]);
  
  // 导出主题
  const exportTheme = useCallback(() => {
    // 实现主题导出逻辑
  }, []);
  
  // 导入主题
  const importTheme = useCallback((themeData: string) => {
    // 实现主题导入逻辑
  }, []);
  
  return {
    devToolsOpen,
    toggleDevTools,
    exportTheme,
    importTheme,
  };
};

export default {
  useThemeConfig,
  useThemeStyles,
  useThemeVariants,
  useThemeComponent,
  useResponsiveStyles,
  useThemeAnimation,
  useThemeAccessibility,
  useThemePerformance,
  useThemeStorage,
  useThemeEvents,
  useThemeDevTools,
};