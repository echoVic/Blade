/**
 * 主题系统使用示例组件
 * 展示如何使用主题hooks和组件
 */

import React, { useState } from 'react';
import { 
  useTheme, 
  useToken, 
  useStyles, 
  useThemeMode,
  useThemeSwitcher,
  useThemeVariant
} from '../contexts/ThemeContext';
import { 
  useThemeStyles,
  useThemeComponent,
  useThemeAccessibility
} from '../hooks/useTheme';

// 示例文本组件
export const ThemedText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const textColor = useToken<string>('colors.text.primary');
  const fontSize = useToken<number>('typography.fontSize.base');
  
  const styles = useStyles((theme) => ({
    color: theme.tokens.colors.text.primary,
    fontSize: `${theme.tokens.typography.fontSize.base}rem`,
    fontFamily: theme.tokens.typography.fontFamily.sans.join(', '),
  }));
  
  return (
    <p style={{ ...styles, margin: 0 }}>
      {children}
    </p>
  );
};

// 示例按钮组件
export const ThemedButton: React.FC<{
  children: React.ReactNode;
  variant?: string;
  onClick?: () => void;
}> = ({ children, variant = 'primary', onClick }) => {
  const { theme } = useTheme();
  
  const buttonStyles = useThemeStyles({
    styles: (theme) => {
      const baseStyles = {
        padding: `${theme.tokens.spacing.component.padding.sm}rem ${theme.tokens.spacing.component.padding.md}rem`,
        borderRadius: `${theme.tokens.border.radius.md}rem`,
        border: 'none',
        cursor: 'pointer',
        fontSize: `${theme.tokens.typography.fontSize.base}rem`,
        fontWeight: theme.tokens.typography.fontWeight.medium,
        transition: `all ${theme.tokens.animation.duration.fast}ms ${theme.tokens.animation.easing.easeInOut}`,
      };
      
      const variantStyles = {
        primary: {
          backgroundColor: theme.tokens.colors.semantic.primary[500],
          color: theme.tokens.colors.text.inverse,
          '&:hover': {
            backgroundColor: theme.tokens.colors.semantic.primary[600],
          },
        },
        secondary: {
          backgroundColor: theme.tokens.colors.semantic.secondary[500],
          color: theme.tokens.colors.text.inverse,
          '&:hover': {
            backgroundColor: theme.tokens.colors.semantic.secondary[600],
          },
        },
        accent: {
          backgroundColor: theme.tokens.colors.semantic.accent[500],
          color: theme.tokens.colors.text.inverse,
          '&:hover': {
            backgroundColor: theme.tokens.colors.semantic.accent[600],
          },
        },
      };
      
      return {
        ...baseStyles,
        ...variantStyles[variant as keyof typeof variantStyles],
      };
    },
  });
  
  return (
    <button 
      style={buttonStyles as React.CSSProperties} 
      onClick={onClick}
      className="themed-button"
    >
      {children}
    </button>
  );
};

// 示例卡片组件
export const ThemedCard: React.FC<{
  children: React.ReactNode;
  title?: string;
}> = ({ children, title }) => {
  const cardStyles = useStyles((theme) => ({
    backgroundColor: theme.tokens.colors.functional.background.surface,
    border: `${theme.tokens.border.width.normal}rem solid ${theme.tokens.colors.border.default}`,
    borderRadius: `${theme.tokens.border.radius.lg}rem`,
    padding: `${theme.tokens.spacing.component.padding.lg}rem`,
    boxShadow: theme.tokens.shadow.box.md,
    marginBottom: `${theme.tokens.spacing.component.margin.md}rem`,
  }));
  
  const titleStyles = useStyles((theme) => ({
    color: theme.tokens.colors.text.primary,
    fontSize: `${theme.tokens.typography.fontSize.xl}rem`,
    fontWeight: theme.tokens.typography.fontWeight.semibold,
    marginBottom: `${theme.tokens.spacing.component.margin.sm}rem`,
  }));
  
  return (
    <div style={cardStyles} className="themed-card">
      {title && <h3 style={titleStyles}>{title}</h3>}
      {children}
    </div>
  );
};

// 示例主题切换器
export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = useThemeMode();
  const [themeId, setTheme] = useThemeSwitcher();
  
  return (
    <div style={{ 
      display: 'flex', 
      gap: '1rem', 
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: 'var(--background-secondary)',
      borderRadius: '0.5rem',
      marginBottom: '1rem'
    }}>
      <span>主题模式:</span>
      <button 
        onClick={() => setMode('light')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: mode === 'light' ? 'var(--primary-color)' : 'var(--background-tertiary)',
          color: mode === 'light' ? 'white' : 'var(--text-primary)',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
        }}
      >
        亮色
      </button>
      <button 
        onClick={() => setMode('dark')}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: mode === 'dark' ? 'var(--primary-color)' : 'var(--background-tertiary)',
          color: mode === 'dark' ? 'white' : 'var(--text-primary)',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
        }}
      >
        暗色
      </button>
      
      <span>主题:</span>
      <select 
        value={themeId}
        onChange={(e) => setTheme(e.target.value)}
        style={{
          padding: '0.5rem',
          borderRadius: '0.25rem',
          border: '1px solid var(--border-default)',
        }}
      >
        <option value="default">默认</option>
        <option value="dark">深色</option>
        <option value="ayu-dark">Ayu Dark</option>
        <option value="dracula">Dracula</option>
        <option value="nord">Nord</option>
      </select>
    </div>
  );
};

// 主题示例页面
export const ThemeExamplePage: React.FC = () => {
  const { theme, mode } = useTheme();
  const [count, setCount] = useState(0);
  
  const { styles: accessibilityStyles } = useThemeAccessibility({
    highContrast: false,
    enableKeyboardNavigation: true,
  });
  
  return (
    <div style={{
      padding: '2rem',
      backgroundColor: theme.tokens.colors.functional.background.primary,
      color: theme.tokens.colors.text.primary,
      minHeight: '100vh',
      fontFamily: theme.tokens.typography.fontFamily.sans.join(', '),
    }}>
      <style>
        {Object.entries(accessibilityStyles).map(([key, value]) => 
          `${key} { ${typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${k}: ${v}`).join('; ') : value} }`
        ).join('\n')}
      </style>
      
      <ThemeToggle />
      
      <ThemedCard title="主题系统示例">
        <ThemedText>
          当前主题: {theme.name} ({mode} mode)
        </ThemedText>
        
        <div style={{ margin: '1rem 0' }}>
          <ThemedButton variant="primary" onClick={() => setCount(c => c + 1)}>
            点击计数: {count}
          </ThemedButton>
        </div>
        
        <div style={{ margin: '1rem 0' }}>
          <ThemedButton variant="secondary" onClick={() => alert('Hello Theme!')}>
            弹出提示
          </ThemedButton>
        </div>
        
        <div style={{ margin: '1rem 0' }}>
          <ThemedButton variant="accent">
            特色按钮
          </ThemedButton>
        </div>
      </ThemedCard>
      
      <ThemedCard title="颜色示例">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(theme.tokens.colors.semantic.primary).map(([key, value]) => (
            <div 
              key={key} 
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: value,
                borderRadius: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                color: parseInt(key) > 500 ? 'white' : 'black',
              }}
            >
              {key}
            </div>
          ))}
        </div>
      </ThemedCard>
      
      <ThemedCard title="排版示例">
        <div>
          {Object.entries(theme.tokens.typography.fontSize).map(([key, value]) => (
            <div key={key} style={{ 
              fontSize: `${value}rem`, 
              marginBottom: '0.5rem',
              color: theme.tokens.colors.text.primary,
            }}>
              Font Size {key}: {value}rem
            </div>
          ))}
        </div>
      </ThemedCard>
    </div>
  );
};

export default {
  ThemedText,
  ThemedButton,
  ThemedCard,
  ThemeToggle,
  ThemeExamplePage,
};