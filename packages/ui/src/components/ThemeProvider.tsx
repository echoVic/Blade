/**
 * 主题提供者组件
 * 封装主题管理逻辑和UI组件
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  ThemeProviderProps, 
  ThemeSwitcherProps, 
  ThemeSelectorProps,
  ThemeToolbarProps,
  ThemeDesignerProps
} from '../../types/theme-hooks';
import { useTheme, ThemeConsumer } from '../../contexts/ThemeContext';
import { ThemeEngine } from '../../core/theme-engine';

/**
 * 主题切换器组件
 */
export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  themes,
  currentTheme,
  currentMode,
  onThemeChange,
  onModeChange,
  style,
  className = '',
}) => {
  return (
    <div 
      className={`theme-switcher ${className}`}
      style={style}
      data-testid="theme-switcher"
    >
      {/* 主题选择 */}
      <select
        value={currentTheme}
        onChange={(e) => onThemeChange(e.target.value)}
        className="theme-switcher__select"
        data-testid="theme-selector"
      >
        {themes.map(theme => (
          <option key={theme} value={theme}>
            {theme}
          </option>
        ))}
      </select>

      {/* 模式切换 */}
      <div className="theme-switcher__mode-toggle">
        <button
          onClick={() => onModeChange('light')}
          className={`mode-button ${currentMode === 'light' ? 'active' : ''}`}
          data-testid="light-mode-button"
        >
          ☀️
        </button>
        <button
          onClick={() => onModeChange('dark')}
          className={`mode-button ${currentMode === 'dark' ? 'active' : ''}`}
          data-testid="dark-mode-button"
        >
          🌙
        </button>
      </div>
    </div>
  );
};

/**
 * 主题选择器组件
 */
export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  themes,
  currentTheme,
  currentMode,
  onThemeChange,
  onModeChange,
  type = 'dropdown',
  showThemeNames = true,
  showPreview = false,
  customOptions = {},
}) => {
  const themeOptions = useMemo(() => {
    return themes.map(theme => ({
      id: theme,
      name: theme.charAt(0).toUpperCase() + theme.slice(1),
      preview: showPreview ? `preview-${theme}` : undefined,
    }));
  }, [themes, showPreview]);

  switch (type) {
    case 'tabs':
      return (
        <div className="theme-selector theme-selector--tabs" data-testid="theme-selector-tabs">
          <div className="theme-tabs">
            {themeOptions.map(option => (
              <button
                key={option.id}
                onClick={() => onThemeChange(option.id)}
                className={`tab ${currentTheme === option.id ? 'active' : ''}`}
                data-testid={`theme-tab-${option.id}`}
              >
                {showThemeNames && option.name}
              </button>
            ))}
          </div>
          
          <div className="mode-toggle">
            <ThemeSwitcher
              themes={themes}
              currentTheme={currentTheme}
              currentMode={currentMode}
              onThemeChange={onThemeChange}
              onModeChange={onModeChange}
            />
          </div>
        </div>
      );

    case 'buttons':
      return (
        <div className="theme-selector theme-selector--buttons" data-testid="theme-selector-buttons">
          <div className="theme-buttons">
            {themeOptions.map(option => (
              <button
                key={option.id}
                onClick={() => onThemeChange(option.id)}
                className={`theme-button ${currentTheme === option.id ? 'active' : ''}`}
                data-testid={`theme-button-${option.id}`}
              >
                {showThemeNames && option.name}
                {showPreview && option.preview && (
                  <div className="theme-preview">{option.preview}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      );

    case 'slider':
      return (
        <div className="theme-selector theme-selector--slider" data-testid="theme-selector-slider">
          <input
            type="range"
            min="0"
            max={themes.length - 1}
            value={themes.indexOf(currentTheme)}
            onChange={(e) => onThemeChange(themes[parseInt(e.target.value)])}
            className="theme-slider"
            data-testid="theme-slider"
          />
          <div className="theme-slider-label">
            {showThemeNames && themeOptions.find(t => t.id === currentTheme)?.name}
          </div>
        </div>
      );

    default: // dropdown
      return (
        <div className="theme-selector theme-selector--dropdown" data-testid="theme-selector-dropdown">
          <ThemeSwitcher
            themes={themes}
            currentTheme={currentTheme}
            currentMode={currentMode}
            onThemeChange={onThemeChange}
            onModeChange={onModeChange}
          />
        </div>
      );
  }
};

/**
 * 主题工具栏组件
 */
export const ThemeToolbar: React.FC<ThemeToolbarProps> = ({
  position = 'top',
  orientation = 'horizontal',
  style,
  className = '',
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { theme, mode, setTheme, setMode } = useTheme();
  
  const toggleToolbar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const availableThemes = useMemo(() => {
    // 获取可用的主题列表
    return ['default', 'dark', 'light'];
  }, []);

  return (
    <div
      className={`theme-toolbar theme-toolbar--${position} theme-toolbar--${orientation} ${isOpen ? 'open' : 'closed'} ${className}`}
      style={style}
      data-testid="theme-toolbar"
    >
      <button
        onClick={toggleToolbar}
        className="theme-toolbar__toggle"
        data-testid="toolbar-toggle"
      >
        {isOpen ? '✕' : '🎨'}
      </button>

      {isOpen && (
        <div className="theme-toolbar__content" data-testid="toolbar-content">
          <ThemeSelector
            themes={availableThemes}
            currentTheme={theme.id}
            currentMode={mode}
            onThemeChange={setTheme}
            onModeChange={setMode}
          />
        </div>
      )}
    </div>
  );
};

/**
 * 主题令牌浏览器组件
 */
export const ThemeTokenBrowser: React.FC<any> = ({
  tokens,
  filter = '',
  searchable = true,
  defaultExpanded = false,
  showType = true,
  showPath = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [searchTerm, setSearchTerm] = useState(filter);
  const { theme, getToken } = useTheme();

  const themeTokens = useMemo(() => {
    return tokens || theme.tokens;
  }, [tokens, theme]);

  const filteredTokens = useMemo(() => {
    if (!searchTerm) return themeTokens;
    
    const result: Record<string, any> = {};
    const searchLower = searchTerm.toLowerCase();
    
    const searchTokens = (obj: any, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (path.toLowerCase().includes(searchLower)) {
          result[path] = value;
        }
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          searchTokens(value, path);
        }
      });
    };
    
    searchTokens(themeTokens);
    return result;
  }, [themeTokens, searchTerm]);

  const renderTokenValue = (value: any, path: string) => {
    if (typeof value === 'object') {
      return (
        <div className="token-object">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="token-property">
              <span className="token-key">{key}:</span>
              <span className="token-value">{String(val)}</span>
              {showType && <span className="token-type">({typeof val})</span>}
            </div>
          ))}
        </div>
      );
    }
    
    return (
      <div className="token-primitive">
        <span className="token-value">{String(value)}</span>
        {showType && <span className="token-type">({typeof value})</span>}
      </div>
    );
  };

  return (
    <div className="theme-token-browser" data-testid="token-browser">
      {searchable && (
        <div className="token-browser__search">
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="token-search-input"
            data-testid="token-search"
          />
        </div>
      )}

      <div className="token-browser__header">
        <button
          onClick={() => setExpanded(!expanded)}
          className="token-browser__expand-toggle"
          data-testid="expand-toggle"
        >
          {expanded ? '▼' : '▶'} Tokens
        </button>
      </div>

      {expanded && (
        <div className="token-browser__list" data-testid="token-list">
          {Object.entries(filteredTokens).map(([path, value]) => (
            <div key={path} className="token-item" data-testid={`token-${path}`}>
              {showPath && <div className="token-path">{path}</div>}
              <div className="token-preview">{renderTokenValue(value, path)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 主题设计器组件
 */
export const ThemeDesigner: React.FC<ThemeDesignerProps> = ({
  designTheme,
  onDesignChange,
  presetThemes = [],
  defaultPanel = 'colors',
  livePreview = true,
  saveToLocal = false,
}) => {
  const [activePanel, setActivePanel] = useState(defaultPanel);
  const [localTheme, setLocalTheme] = useState(designTheme);
  const { theme, setTheme } = useTheme();

  const currentTheme = useMemo(() => {
    return localTheme || designTheme || theme;
  }, [localTheme, designTheme, theme]);

  const updateTheme = useCallback((updates: Partial<any>) => {
    const newTheme = { ...currentTheme, ...updates };
    setLocalTheme(newTheme);
    
    if (onDesignChange) {
      onDesignChange(newTheme);
    }
    
    if (livePreview) {
      // 实时预览更新
    }
  }, [currentTheme, onDesignChange, livePreview]);

  const saveTheme = useCallback(() => {
    if (localTheme) {
      if (saveToLocal) {
        // 保存到本地存储
        localStorage.setItem('custom-theme', JSON.stringify(localTheme));
      }
      
      // 应用主题
      setTheme(localTheme.id);
    }
  }, [localTheme, saveToLocal, setTheme]);

  const resetTheme = useCallback(() => {
    setLocalTheme(undefined);
    if (onDesignChange) {
      onDesignChange(theme);
    }
  }, [theme, onDesignChange]);

  return (
    <div className="theme-designer" data-testid="theme-designer">
      <div className="theme-designer__header">
        <h2>Theme Designer</h2>
        <div className="theme-designer__actions">
          <button onClick={saveTheme} className="btn btn-primary" data-testid="save-theme">
            Save
          </button>
          <button onClick={resetTheme} className="btn btn-secondary" data-testid="reset-theme">
            Reset
          </button>
        </div>
      </div>

      <div className="theme-designer__layout">
        <div className="theme-designer__sidebar">
          <nav className="designer-nav">
            <button
              onClick={() => setActivePanel('colors')}
              className={`nav-item ${activePanel === 'colors' ? 'active' : ''}`}
              data-testid="colors-panel"
            >
              Colors
            </button>
            <button
              onClick={() => setActivePanel('typography')}
              className={`nav-item ${activePanel === 'typography' ? 'active' : ''}`}
              data-testid="typography-panel"
            >
              Typography
            </button>
            <button
              onClick={() => setActivePanel('spacing')}
              className={`nav-item ${activePanel === 'spacing' ? 'active' : ''}`}
              data-testid="spacing-panel"
            >
              Spacing
            </button>
            <button
              onClick={() => setActivePanel('layouts')}
              className={`nav-item ${activePanel === 'layouts' ? 'active' : ''}`}
              data-testid="layouts-panel"
            >
              Layouts
            </button>
          </nav>
        </div>

        <div className="theme-designer__main">
          <div className="designer-panel">
            {activePanel === 'colors' && (
              <div className="panel-content colors-panel" data-testid="colors-content">
                <h3>Color Tokens</h3>
                {/* 颜色令牌编辑器 */}
              </div>
            )}

            {activePanel === 'typography' && (
              <div className="panel-content typography-panel" data-testid="typography-content">
                <h3>Typography Tokens</h3>
                {/* 排版令牌编辑器 */}
              </div>
            )}

            {activePanel === 'spacing' && (
              <div className="panel-content spacing-panel" data-testid="spacing-content">
                <h3>Spacing Tokens</h3>
                {/* 间距令牌编辑器 */}
              </div>
            )}

            {activePanel === 'layouts' && (
              <div className="panel-content layouts-panel" data-testid="layouts-content">
                <h3>Layout Tokens</h3>
                {/* 布局令牌编辑器 */}
              </div>
            )}
          </div>
        </div>

        {livePreview && (
          <div className="theme-designer__preview">
            <div className="preview-header">
              <h3>Live Preview</h3>
            </div>
            <div className="preview-content">
              {/* 实时预览内容 */}
              <div className="preview-sample">
                <h4>Sample Text</h4>
                <p>This is a sample of how your theme looks.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  ThemeSwitcher,
  ThemeSelector,
  ThemeToolbar,
  ThemeTokenBrowser,
  ThemeDesigner,
};