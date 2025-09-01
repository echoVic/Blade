import React, { createContext, useContext, useState, useEffect } from 'react';

// 主题类型定义
export interface Theme {
  name: string;
  colors: {
    // 主要颜色
    primary: string;
    secondary: string;
    accent: string;
    
    // 文本颜色
    text: string;
    textSecondary: string;
    textTertiary: string;
    
    // 背景颜色
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    
    // 状态颜色
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // 边框颜色
    border: string;
    borderFocus: string;
    
    // 其他颜色
    highlight: string;
    muted: string;
  };
  
  // 字体设置
  typography: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
  
  // 间距设置
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  
  // 边框圆角
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  
  // 阴影
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  
  // 动画
  animation: {
    duration: string;
    timingFunction: string;
  };
}

// 预定义主题
export const themes: Record<string, Theme> = {
  // 默认主题
  default: {
    name: '默认主题',
    colors: {
      primary: '#3B82F6',
      secondary: '#6B7280',
      accent: '#8B5CF6',
      text: '#1F2937',
      textSecondary: '#4B5563',
      textTertiary: '#9CA3AF',
      background: '#FFFFFF',
      backgroundSecondary: '#F9FAFB',
      backgroundTertiary: '#F3F4F6',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
      border: '#E5E7EB',
      borderFocus: '#3B82F6',
      highlight: '#FEF3C7',
      muted: '#F3F4F6',
    },
    typography: {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 1.4,
    },
    spacing: {
      xs: 1,
      sm: 2,
      md: 4,
      lg: 8,
      xl: 16,
    },
    borderRadius: {
      sm: 2,
      md: 4,
      lg: 8,
      full: 9999,
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },
    animation: {
      duration: '0.2s',
      timingFunction: 'ease-in-out',
    },
  },
  
  // 深色主题
  dark: {
    name: '深色主题',
    colors: {
      primary: '#60A5FA',
      secondary: '#9CA3AF',
      accent: '#A78BFA',
      text: '#F9FAFB',
      textSecondary: '#E5E7EB',
      textTertiary: '#D1D5DB',
      background: '#111827',
      backgroundSecondary: '#1F2937',
      backgroundTertiary: '#374151',
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      info: '#60A5FA',
      border: '#374151',
      borderFocus: '#60A5FA',
      highlight: '#FEF3C7',
      muted: '#1F2937',
    },
    typography: {
      fontFamily: 'monospace',
      fontSize: 14,
      lineHeight: 1.4,
    },
    spacing: {
      xs: 1,
      sm: 2,
      md: 4,
      lg: 8,
      xl: 16,
    },
    borderRadius: {
      sm: 2,
      md: 4,
      lg: 8,
      full: 9999,
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.1)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
    },
    animation: {
      duration: '0.2s',
      timingFunction: 'ease-in-out',
    },
  },
  
  // 高对比度主题
  highContrast: {
    name: '高对比度主题',
    colors: {
      primary: '#0066CC',
      secondary: '#666666',
      accent: '#990099',
      text: '#000000',
      textSecondary: '#333333',
      textTertiary: '#666666',
      background: '#FFFFFF',
      backgroundSecondary: '#F0F0F0',
      backgroundTertiary: '#E0E0E0',
      success: '#009900',
      warning: '#FF9900',
      error: '#CC0000',
      info: '#0066CC',
      border: '#000000',
      borderFocus: '#0000FF',
      highlight: '#FFFF00',
      muted: '#F0F0F0',
    },
    typography: {
      fontFamily: 'monospace',
      fontSize: 16,
      lineHeight: 1.5,
    },
    spacing: {
      xs: 2,
      sm: 4,
      md: 6,
      lg: 10,
      xl: 18,
    },
    borderRadius: {
      sm: 0,
      md: 0,
      lg: 0,
      full: 0,
    },
    shadows: {
      sm: '0 1px 1px 0 rgba(0, 0, 0, 0.5)',
      md: '0 2px 4px 0 rgba(0, 0, 0, 0.5)',
      lg: '0 4px 8px 0 rgba(0, 0, 0, 0.5)',
    },
    animation: {
      duration: '0s',
      timingFunction: 'linear',
    },
  },
};

// 主题上下文
interface ThemeContextType {
  theme: Theme;
  setTheme: (themeName: string) => void;
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者组件
export const ThemeProvider: React.FC<{
  theme?: Theme;
  children: React.ReactNode;
}> = ({ theme, children }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(
    theme || themes.default
  );
  
  const [themeName, setThemeName] = useState<string>('default');

  // 从本地存储加载主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('blade-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(themes[savedTheme]);
      setThemeName(savedTheme);
    }
  }, []);

  // 保存主题到本地存储
  useEffect(() => {
    localStorage.setItem('blade-theme', themeName);
  }, [themeName]);

  const setTheme = (themeName: string) => {
    if (themes[themeName]) {
      setCurrentTheme(themes[themeName]);
      setThemeName(themeName);
    }
  };

  const value = {
    theme: currentTheme,
    setTheme,
    availableThemes: Object.keys(themes),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// 使用主题的Hook
export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context.theme;
};

// 使用主题管理器的Hook
export const useThemeManager = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeManager must be used within a ThemeProvider');
  }
  
  return {
    theme: context.theme,
    setTheme: context.setTheme,
    availableThemes: context.availableThemes,
    currentThemeName: context.availableThemes.find(
      name => themes[name] === context.theme
    ) || 'default',
  };
};

// 主题工具函数
export const getThemeColor = (theme: Theme, colorKey: keyof Theme['colors']): string => {
  return theme.colors[colorKey];
};

export const getThemeSpacing = (theme: Theme, spacingKey: keyof Theme['spacing']): number => {
  return theme.spacing[spacingKey];
};

export const getThemeTypography = (theme: Theme) => {
  return theme.typography;
};

// 导出默认主题
export default themes.default;