/**
 * 主题引擎单元测试
 */

import { ThemeEngine } from '../core/theme-engine';
import { ThemeValidator } from '../core/theme-validator';
import { DesignTokenSystem } from '../core/design-token-system';
import { defaultTheme, darkTheme } from '../themes/builtin-themes';
import type { ThemeConfig, ThemeEvent } from '../types/theme-engine';

describe('ThemeEngine', () => {
  let themeEngine: ThemeEngine;

  beforeEach(async () => {
    themeEngine = new ThemeEngine();
    await themeEngine.initialize();
  });

  afterEach(async () => {
    await themeEngine.destroy();
  });

  describe('Initialization', () => {
    it('应该正确初始化主题引擎', () => {
      expect(themeEngine).toBeDefined();
      expect(themeEngine.getCurrentTheme()).toBeDefined();
      expect(themeEngine.getCurrentMode()).toBe('light');
    });

    it('应该加载默认主题', () => {
      const theme = themeEngine.getCurrentTheme();
      expect(theme).toBeDefined();
      expect(theme?.id).toBe('default');
    });
  });

  describe('Theme Management', () => {
    it('应该能够设置主题', async () => {
      await themeEngine.setTheme('dark');
      const theme = themeEngine.getCurrentTheme();
      expect(theme?.id).toBe('dark');
    });

    it('应该能够切换模式', async () => {
      await themeEngine.setTheme('default', { mode: 'dark' });
      expect(themeEngine.getCurrentMode()).toBe('dark');
    });

    it('应该能够添加自定义主题', async () => {
      const customTheme: ThemeConfig = {
        id: 'custom',
        name: 'Custom Theme',
        description: 'A custom theme for testing',
        version: '1.0.0',
        author: 'Test',
        isDark: false,
        tokens: defaultTheme.tokens,
      };

      await themeEngine.addTheme(customTheme);
      const availableThemes = themeEngine.getAvailableThemes();
      expect(availableThemes.some(t => t.id === 'custom')).toBe(true);
    });

    it('应该能够移除主题', async () => {
      // 先添加一个自定义主题
      const customTheme: ThemeConfig = {
        id: 'removable',
        name: 'Removable Theme',
        description: 'A theme that can be removed',
        version: '1.0.0',
        author: 'Test',
        isDark: false,
        tokens: defaultTheme.tokens,
      };

      await themeEngine.addTheme(customTheme);
      
      // 确保主题存在
      let availableThemes = themeEngine.getAvailableThemes();
      expect(availableThemes.some(t => t.id === 'removable')).toBe(true);

      // 移除主题
      await themeEngine.removeTheme('removable');
      
      // 确保主题已被移除
      availableThemes = themeEngine.getAvailableThemes();
      expect(availableThemes.some(t => t.id === 'removable')).toBe(false);
    });
  });

  describe('Token Access', () => {
    it('应该能够获取令牌值', () => {
      const whiteColor = themeEngine.getToken('colors.base.white');
      expect(whiteColor).toBe('#FFFFFF');
    });

    it('应该能够获取嵌套令牌值', () => {
      const primary500 = themeEngine.getToken('colors.semantic.primary.500');
      expect(primary500).toBe('#3B82F6');
    });

    it('应该在访问不存在的令牌时返回undefined', () => {
      const invalidToken = themeEngine.getToken('invalid.token.path');
      expect(invalidToken).toBeUndefined();
    });
  });

  describe('Events', () => {
    it('应该能够监听主题变更事件', async () => {
      const eventHandler = jest.fn();
      themeEngine.on('theme:changed', eventHandler);
      
      await themeEngine.setTheme('dark');
      
      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'theme:changed',
          data: expect.objectContaining({
            newTheme: 'dark'
          })
        })
      );
    });

    it('应该能够监听令牌访问事件', () => {
      const eventHandler = jest.fn();
      themeEngine.on('theme:token:accessed', eventHandler);
      
      themeEngine.getToken('colors.base.white');
      
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance', () => {
    it('应该能够获取性能指标', () => {
      const metrics = themeEngine.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.themeLoadTime).toBe('number');
    });

    it('应该能够重置性能指标', () => {
      themeEngine.resetPerformanceMetrics();
      const metrics = themeEngine.getPerformanceMetrics();
      expect(metrics.themeLoadTime).toBe(0);
    });
  });
});

describe('ThemeValidator', () => {
  let validator: ThemeValidator;

  beforeEach(() => {
    validator = new ThemeValidator({
      validationLevel: 'normal',
      debug: false,
    } as any);
  });

  describe('Theme Validation', () => {
    it('应该验证有效的主题', () => {
      const result = validator.validateTheme(defaultTheme);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测无效的颜色格式', () => {
      const invalidTheme: ThemeConfig = {
        ...defaultTheme,
        tokens: {
          ...defaultTheme.tokens,
          colors: {
            ...defaultTheme.tokens.colors,
            base: {
              ...defaultTheme.tokens.colors.base,
              white: 'invalid-color', // 无效的颜色格式
            },
          },
        },
      };

      const result = validator.validateTheme(invalidTheme);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'colors.base.white')).toBe(true);
    });

    it('应该检测缺失的必需属性', () => {
      const invalidTheme: any = {
        ...defaultTheme,
        id: undefined, // 缺失必需的ID
      };

      const result = validator.validateTheme(invalidTheme);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'id')).toBe(true);
    });
  });

  describe('Token Validation', () => {
    it('应该验证颜色令牌', () => {
      const result = validator.validateTokens(defaultTheme.tokens);
      expect(result.isValid).toBe(true);
    });

    it('应该验证排版令牌', () => {
      const typography = defaultTheme.tokens.typography;
      // 这里可以添加具体的排版令牌验证测试
      expect(typography).toBeDefined();
    });
  });
});

describe('DesignTokenSystem', () => {
  let tokenSystem: DesignTokenSystem;

  beforeEach(() => {
    tokenSystem = new DesignTokenSystem();
  });

  describe('Token Access', () => {
    it('应该能够获取默认令牌', () => {
      const whiteColor = tokenSystem.getToken('colors.base.white');
      expect(whiteColor).toBe('#FFFFFF');
    });

    it('应该能够获取语义化颜色', () => {
      const primary500 = tokenSystem.getToken('colors.semantic.primary.500');
      expect(primary500).toBe('#3B82F6');
    });

    it('应该缓存令牌值', () => {
      // 第一次访问
      const startTime = performance.now();
      tokenSystem.getToken('colors.base.white');
      const firstAccessTime = performance.now() - startTime;

      // 第二次访问（应该从缓存中获取）
      const secondStartTime = performance.now();
      tokenSystem.getToken('colors.base.white');
      const secondAccessTime = performance.now() - secondStartTime;

      // 第二次访问应该更快（使用缓存）
      expect(secondAccessTime).toBeLessThanOrEqual(firstAccessTime);
    });
  });

  describe('Token Validation', () => {
    it('应该验证令牌值', () => {
      const result = tokenSystem.validateToken('colors.base.white', '#FFFFFF');
      expect(result.isValid).toBe(true);
    });

    it('应该检测无效的令牌值', () => {
      const result = tokenSystem.validateToken('colors.base.white', 'invalid-color');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Token Conversion', () => {
    it('应该能够转换为CSS格式', () => {
      const css = tokenSystem.convertToFormat('css');
      expect(typeof css).toBe('string');
      expect(css).toContain(':root');
      expect(css).toContain('--colors-base-white');
    });

    it('应该能够转换为JSON格式', () => {
      const json = tokenSystem.convertToFormat('json');
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});