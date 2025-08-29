/**
 * 主题验证系统
 * 提供主题配置验证、令牌验证和完整性检查
 */

import type {
  ThemeConfig,
  ThemeValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationRecommendation,
  ThemeValidationRule,
} from '../types/design-tokens';
import type { DesignTokens } from '../types/design-tokens';
import type { ThemeEngineConfig } from '../types/theme-engine';

export class ThemeValidator {
  private rules: Map<string, ThemeValidationRule> = new Map();
  private config: ThemeEngineConfig;

  constructor(config: ThemeEngineConfig) {
    this.config = config;
    this.initializeRules();
  }

  /**
   * 验证主题配置
   */
  public validateTheme(theme: ThemeConfig): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 基础属性验证
    errors.push(...this.validateBasicProperties(theme));
    
    // 令牌验证
    const tokenResult = this.validateTokens(theme.tokens);
    errors.push(...tokenResult.errors);
    warnings.push(...tokenResult.warnings);
    recommendations.push(...tokenResult.recommendations);
    
    // 组件配置验证
    if (theme.components) {
      errors.push(...this.validateComponents(theme.components));
    }
    
    // 自定义令牌验证
    if (theme.customTokens) {
      errors.push(...this.validateCustomTokens(theme.customTokens));
    }
    
    // 主题完整性检查
    const integrityResult = this.checkThemeIntegrity(theme);
    errors.push(...integrityResult.errors);
    warnings.push(...integrityResult.warnings);
    recommendations.push(...integrityResult.recommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证主题令牌
   */
  public validateTokens(tokens: DesignTokens): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 颜色令牌验证
    const colorResult = this.validateColorTokens(tokens.colors);
    errors.push(...colorResult.errors);
    warnings.push(...colorResult.warnings);
    recommendations.push(...colorResult.recommendations);

    // 排版令牌验证
    const typographyResult = this.validateTypographyTokens(tokens.typography);
    errors.push(...typographyResult.errors);
    warnings.push(...typographyResult.warnings);
    recommendations.push(...typographyResult.recommendations);

    // 间距令牌验证
    const spacingResult = this.validateSpacingTokens(tokens.spacing);
    errors.push(...spacingResult.errors);
    warnings.push(...spacingResult.warnings);
    recommendations.push(...spacingResult.recommendations);

    // 边框令牌验证
    const borderResult = this.validateBorderTokens(tokens.border);
    errors.push(...borderResult.errors);
    warnings.push(...borderResult.warnings);
    recommendations.push(...borderResult.recommendations);

    // 阴影令牌验证
    const shadowResult = this.validateShadowTokens(tokens.shadow);
    errors.push(...shadowResult.errors);
    warnings.push(...shadowResult.warnings);
    recommendations.push(...shadowResult.recommendations);

    // 动画令牌验证
    const animationResult = this.validateAnimationTokens(tokens.animation);
    errors.push(...animationResult.errors);
    warnings.push(...animationResult.warnings);
    recommendations.push(...animationResult.recommendations);

    // 布局令牌验证
    const layoutResult = this.validateLayoutTokens(tokens.layout);
    errors.push(...layoutResult.errors);
    warnings.push(...layoutResult.warnings);
    recommendations.push(...layoutResult.recommendations);

    // 渐变令牌验证
    const gradientResult = this.validateGradientTokens(tokens.gradient);
    errors.push(...gradientResult.errors);
    warnings.push(...gradientResult.warnings);
    recommendations.push(...gradientResult.recommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证颜色令牌
   */
  private validateColorTokens(colors: DesignTokens['colors']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 基础颜色验证
    if (!colors.base.white) {
      errors.push({
        type: 'required',
        path: 'colors.base.white',
        message: 'White color is required',
        value: undefined,
        expected: 'Valid hex color',
      });
    } else if (!this.isValidColor(colors.base.white)) {
      errors.push({
        type: 'format',
        path: 'colors.base.white',
        message: 'White color must be a valid hex color',
        value: colors.base.white,
        expected: '#FFFFFF format',
      });
    }

    if (!colors.base.black) {
      errors.push({
        type: 'required',
        path: 'colors.base.black',
        message: 'Black color is required',
        value: undefined,
        expected: 'Valid hex color',
      });
    } else if (!this.isValidColor(colors.base.black)) {
      errors.push({
        type: 'format',
        path: 'colors.base.black',
        message: 'Black color must be a valid hex color',
        value: colors.base.black,
        expected: '#000000 format',
      });
    }

    // 灰度调色板验证
    this.validateColorPalette('colors.base.gray', colors.base.gray, errors, warnings);
    this.validateColorPalette('colors.base.neutral', colors.base.neutral, errors, warnings);

    // 语义化颜色验证
    this.validateColorScale('colors.semantic.primary', colors.semantic.primary, errors, warnings);
    this.validateColorScale('colors.semantic.secondary', colors.semantic.secondary, errors, warnings);
    this.validateColorScale('colors.semantic.accent', colors.semantic.accent, errors, warnings);
    this.validateColorScale('colors.semantic.success', colors.semantic.success, errors, warnings);
    this.validateColorScale('colors.semantic.warning', colors.semantic.warning, errors, warnings);
    this.validateColorScale('colors.semantic.error', colors.semantic.error, errors, warnings);
    this.validateColorScale('colors.semantic.info', colors.semantic.info, errors, warnings);

    // 功能性颜色验证
    this.validateColorAccessibility(colors.functional, warnings, recommendations);

    // 主题颜色验证
    this.validateThemeColors(colors.theme, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证排版令牌
   */
  private validateTypographyTokens(typography: DesignTokens['typography']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 字体族验证
    if (!typography.fontFamily.sans || typography.fontFamily.sans.length === 0) {
      errors.push({
        type: 'required',
        path: 'typography.fontFamily.sans',
        message: 'Sans-serif font family is required',
        value: typography.fontFamily.sans,
        expected: 'Array of font names',
      });
    }

    if (!typography.fontFamily.mono || typography.fontFamily.mono.length === 0) {
      errors.push({
        type: 'required',
        path: 'typography.fontFamily.mono',
        message: 'Monospace font family is required',
        value: typography.fontFamily.mono,
        expected: 'Array of font names',
      });
    }

    // 字体大小验证
    const fontSizes = Object.values(typography.fontSize);
    for (let i = 1; i < fontSizes.length; i++) {
      if (fontSizes[i] <= fontSizes[i - 1]) {
        warnings.push({
          type: 'recommendation',
          path: 'typography.fontSize',
          message: 'Font sizes should be in ascending order',
          suggestion: 'Arrange font sizes from smallest to largest',
        });
        break;
      }
    }

    // 字体粗细验证
    const validFontWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    Object.entries(typography.fontWeight).forEach(([key, weight]) => {
      if (!validFontWeights.includes(weight)) {
        warnings.push({
          type: 'recommendation',
          path: `typography.fontWeight.${key}`,
          message: `Font weight ${weight} is not a standard value`,
          suggestion: 'Use standard font weight values (100-900)',
        });
      }
    });

    // 行高验证
    Object.entries(typography.lineHeight).forEach(([key, lineHeight]) => {
      if (lineHeight < 1 || lineHeight > 3) {
        warnings.push({
          type: 'recommendation',
          path: `typography.lineHeight.${key}`,
          message: `Line height ${lineHeight} is outside recommended range`,
          suggestion: 'Use line height between 1 and 3',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证间距令牌
   */
  private validateSpacingTokens(spacing: DesignTokens['spacing']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 基础间距验证
    if (spacing.base.none !== 0) {
      errors.push({
        type: 'required',
        path: 'spacing.base.none',
        message: 'None spacing must be 0',
        value: spacing.base.none,
        expected: 0,
      });
    }

    // 间距逻辑性验证
    const baseSizes = Object.values(spacing.base);
    for (let i = 1; i < baseSizes.length; i++) {
      if (baseSizes[i] <= baseSizes[i - 1]) {
        warnings.push({
          type: 'recommendation',
          path: 'spacing.base',
          message: 'Base spacing sizes should be in ascending order',
          suggestion: 'Arrange spacing sizes from smallest to largest',
        });
        break;
      }
    }

    // 组件间距验证
    this.validateComponentSpacing(spacing.component, errors, warnings);

    // 响应式间距验证
    this.validateResponsiveSpacing(spacing.responsive, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证边框令牌
   */
  private validateBorderTokens(border: DesignTokens['border']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 边框宽度验证
    if (border.width.none !== 0) {
      errors.push({
        type: 'required',
        path: 'border.width.none',
        message: 'None border width must be 0',
        value: border.width.none,
        expected: 0,
      });
    }

    // 边框圆角验证
    Object.entries(border.radius).forEach(([key, radius]) => {
      if (radius < 0) {
        errors.push({
          type: 'range',
          path: `border.radius.${key}`,
          message: 'Border radius cannot be negative',
          value: radius,
          expected: 'Non-negative number',
        });
      } else if (radius > 50) {
        warnings.push({
          type: 'recommendation',
          path: `border.radius.${key}`,
          message: 'Large border radius values may cause display issues',
          suggestion: 'Use radius values less than 50',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证阴影令牌
   */
  private validateShadowTokens(shadow: DesignTokens['shadow']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 阴影格式验证
    Object.entries(shadow.box).forEach(([key, value]) => {
      if (key !== 'none' && !this.isValidBoxShadow(value)) {
        errors.push({
          type: 'format',
          path: `shadow.box.${key}`,
          message: 'Invalid box shadow format',
          value: value,
          expected: 'Valid CSS box shadow format',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证动画令牌
   */
  private validateAnimationTokens(animation: DesignTokens['animation']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 动画持续时间验证
    Object.entries(animation.duration).forEach(([key, value]) => {
      if (value < 0) {
        errors.push({
          type: 'range',
          path: `animation.duration.${key}`,
          message: 'Animation duration cannot be negative',
          value: value,
          expected: 'Non-negative number',
        });
      } else if (value > 2000) {
        warnings.push({
          type: 'performance',
          path: `animation.duration.${key}`,
          message: 'Long animation durations may hurt performance',
          suggestion: 'Use durations less than 2000ms',
        });
      }
    });

    // 动画延迟验证
    Object.entries(animation.delay).forEach(([key, value]) => {
      if (value < 0) {
        warnings.push({
          type: 'recommendation',
          path: `animation.delay.${key}`,
          message: 'Negative animation delays may cause visual issues',
          suggestion: 'Use non-negative delay values',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证布局令牌
   */
  private validateLayoutTokens(layout: DesignTokens['layout']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 断点验证
    const breakpoints = Object.entries(layout.breakpoints);
    for (let i = 1; i < breakpoints.length; i++) {
      const [key1, value1] = breakpoints[i - 1];
      const [key2, value2] = breakpoints[i];
      
      if (value2 <= value1) {
        errors.push({
          type: 'range',
          path: 'layout.breakpoints',
          message: `Breakpoint ${key2} (${value2}) must be greater than ${key1} (${value1})`,
          value: layout.breakpoints,
          expected: 'Incrementing breakpoint values',
        });
      }
    }

    // 容器宽度验证
    Object.entries(layout.container).forEach(([key, value]) => {
      if (typeof value === 'number' && value < 300) {
        warnings.push({
          type: 'recommendation',
          path: `layout.container.${key}`,
          message: 'Container width is very small',
          suggestion: 'Use container widths greater than 300px',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证渐变令牌
   */
  private validateGradientTokens(gradient: DesignTokens['gradient']): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 线性渐变验证
    Object.entries(gradient.linear).forEach(([key, value]) => {
      if (!this.isValidGradient(value)) {
        errors.push({
          type: 'format',
          path: `gradient.linear.${key}`,
          message: 'Invalid linear gradient format',
          value: value,
          expected: 'Valid CSS linear gradient format',
        });
      }
    });

    // 径向渐变验证
    Object.entries(gradient.radial).forEach(([key, value]) => {
      if (!this.isValidGradient(value)) {
        errors.push({
          type: 'format',
          path: `gradient.radial.${key}`,
          message: 'Invalid radial gradient format',
          value: value,
          expected: 'Valid CSS radial gradient format',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证组件配置
   */
  private validateComponents(components: ThemeConfig['components']): ValidationError[] {
    const errors: ValidationError[] = [];

    Object.entries(components).forEach(([componentName, config]) => {
      if (!config.style) {
        errors.push({
          type: 'required',
          path: `components.${componentName}.style`,
          message: 'Component style configuration is required',
          value: undefined,
          expected: 'Style configuration object',
        });
      }

      if (config.variants) {
        Object.entries(config.variants).forEach(([variantName, variant]) => {
          if (!variant) {
            errors.push({
              type: 'required',
              path: `components.${componentName}.variants.${variantName}`,
              message: 'Variant configuration cannot be empty',
              value: variant,
              expected: 'Variant configuration object',
            });
          }
        });
      }
    });

    return errors;
  }

  /**
   * 验证自定义令牌
   */
  private validateCustomTokens(customTokens: ThemeConfig['customTokens']): ValidationError[] {
    const errors: ValidationError[] = [];

    Object.entries(customTokens).forEach(([key, value]) => {
      if (typeof value === 'undefined' || value === null) {
        errors.push({
          type: 'required',
          path: `customTokens.${key}`,
          message: 'Custom token cannot be null or undefined',
          value: value,
          expected: 'Valid token value',
        });
      }
    });

    return errors;
  }

  /**
   * 验证主题完整性
   */
  private checkThemeIntegrity(theme: ThemeConfig): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 主题一致性检查
    this.checkThemeConsistency(theme, errors, warnings);

    // 无障碍性检查
    this.checkAccessibility(theme, errors, warnings, recommendations);

    // 性能检查
    this.checkPerformance(theme, warnings, recommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  /**
   * 验证基础属性
   */
  private validateBasicProperties(theme: ThemeConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!theme.id) {
      errors.push({
        type: 'required',
        path: 'id',
        message: 'Theme ID is required',
        value: theme.id,
        expected: 'Theme ID string',
      });
    }

    if (!theme.name) {
      errors.push({
        type: 'required',
        path: 'name',
        message: 'Theme name is required',
        value: theme.name,
        expected: 'Theme name string',
      });
    }

    if (!theme.version) {
      warnings.push({
        type: 'recommendation',
        path: 'version',
        message: 'Theme version is recommended',
        suggestion: 'Provide a version number for the theme',
      });
    }

    return errors;
  }

  /**
   * 验证颜色调色板
   */
  private validateColorPalette(path: string, palette: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    
    steps.forEach(step => {
      const colorPath = `${path}.${step}`;
      const color = palette[step];
      
      if (!color) {
        errors.push({
          type: 'required',
          path: colorPath,
          message: `Color step ${step} is required`,
          value: undefined,
          expected: 'Valid hex color',
        });
      } else if (!this.isValidColor(color)) {
        errors.push({
          type: 'format',
          path: colorPath,
          message: `Color step ${step} must be a valid hex color`,
          value: color,
          expected: 'Valid hex color format',
        });
      }
    });

    // 颜色连贯性检查
    this.checkColorProgression(palette, path, warnings);
  }

  /**
   * 验证颜色色阶
   */
  private validateColorScale(path: string, scale: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    this.validateColorPalette(path, scale, errors, warnings);
  }

  /**
   * 验证颜色无障碍性
   */
  private validateColorAccessibility(functionalColors: DesignTokens['colors']['functional'], warnings: ValidationWarning[], recommendations: ValidationRecommendation[]): void {
    // 检查对比度
    const contrast = this.calculateContrast(functionalColors.text.primary, functionalColors.background.primary);
    if (contrast < 4.5) {
      warnings.push({
        type: 'accessibility',
        path: 'colors.functional',
        message: `Low contrast ratio (${contrast.toFixed(2)}) between text and background`,
        suggestion: 'Increase contrast ratio to at least 4.5 for better accessibility',
      });
    }
  }

  /**
   * 验证主题颜色
   */
  private validateThemeColors(themeColors: DesignTokens['colors']['theme'], errors: ValidationError[], warnings: ValidationWarning[]): void {
    // 检查亮色主题
    this.checkThemeColorContrasts(themeColors.light, 'light', errors, warnings);
    
    // 检查暗色主题
    this.checkThemeColorContrasts(themeColors.dark, 'dark', errors, warnings);
  }

  /**
   * 验证组件间距
   */
  private validateComponentSpacing(componentSpacing: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    ['padding', 'margin', 'gap'].forEach(type => {
      const spacing = componentSpacing[type];
      Object.entries(spacing).forEach(([key, value]) => {
        if (value < 0) {
          errors.push({
            type: 'range',
            path: `spacing.component.${type}.${key}`,
            message: 'Component spacing cannot be negative',
            value: value,
            expected: 'Non-negative number',
          });
        }
      });
    });
  }

  /**
   * 验证响应式间距
   */
  private validateResponsiveSpacing(responsiveSpacing: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const devices = Object.entries(responsiveSpacing);
    for (let i = 1; i < devices.length; i++) {
      const [key1, value1] = devices[i - 1];
      const [key2, value2] = devices[i];
      
      if (value2 < value1) {
        warnings.push({
          type: 'recommendation',
          path: 'spacing.responsive',
          message: `Responsive spacing should increase with screen size: ${key1}=${value1}, ${key2}=${value2}`,
          suggestion: 'Use increasing values for larger screen sizes',
        });
      }
    }
  }

  /**
   * 验证主题一致性
   */
  private checkThemeConsistency(theme: ThemeConfig, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // 检查主题名称和标识符的一致性
    if (theme.id && theme.name && !theme.id.toLowerCase().includes(theme.name.toLowerCase())) {
      warnings.push({
        type: 'recommendation',
        path: 'id',
        message: 'Theme ID should be related to theme name',
        suggestion: 'Use a theme ID that reflects the theme name',
      });
    }
  }

  /**
   * 检查无障碍性
   */
  private checkAccessibility(theme: ThemeConfig, errors: ValidationError[], warnings: ValidationWarning[], recommendations: ValidationRecommendation[]): void {
    // 检查颜色对比度
    this.checkColorContrastRatio(theme, errors, warnings);
    
    // 检查字体大小和可读性
    this.checkTypographyReadability(theme, warnings, recommendations);
    
    // 检查交互元素的点击区域
    this.checkInteractiveSizes(theme, warnings, recommendations);
  }

  /**
   * 检查性能
   */
  private checkPerformance(theme: ThemeConfig, warnings: ValidationWarning[], recommendations: ValidationRecommendation[]): void {
    // 检查阴影性能
    this.checkShadowPerformance(theme, warnings);
    
    // 检查动画性能
    this.checkAnimationPerformance(theme, warnings);
    
    // 检查图片和渐变使用
    this.checkVisualPerformance(theme, recommendations);
  }

  /**
   * 工具方法
   */

  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private isValidBoxShadow(shadow: string): boolean {
    return shadow === 'none' || /box-shadow/i.test(shadow);
  }

  private isValidGradient(gradient: string): boolean {
    return /^linear-gradient|^radial-gradient|^conic-gradient/i.test(gradient);
  }

  private calculateContrast(color1: string, color2: string): number {
    // 简化的对比度计算
    const luminance1 = this.calculateLuminance(color1);
    const luminance2 = this.calculateLuminance(color2);
    const brightest = Math.max(luminance1, luminance2);
    const darkest = Math.min(luminance1, luminance2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  private calculateLuminance(color: string): number {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const sRGB = [r, g, b].map(val => {
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }

  private checkColorProgression(palette: any, path: string, warnings: ValidationWarning[]): void {
    // 检查颜色渐进的连贯性
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const luminances = steps.map(step => {
      const color = palette[step];
      return color ? this.calculateLuminance(color) : 0;
    });

    // 检查亮度的单调性
    let increasing = true;
    let decreasing = true;

    for (let i = 1; i < luminances.length; i++) {
      if (luminances[i] < luminances[i - 1]) increasing = false;
      if (luminances[i] > luminances[i - 1]) decreasing = false;
    }

    if (!increasing && !decreasing) {
      warnings.push({
        type: 'recommendation',
        path: path,
        message: 'Color palette should have consistent brightness progression',
        suggestion: 'Arrange colors to either increase or decrease in brightness consistently',
      });
    }
  }

  private checkThemeColorContrasts(themeColors: any, mode: string, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const contrast = this.calculateContrast(themeColors.text, themeColors.background);
    if (contrast < 4.5) {
      warnings.push({
        type: 'accessibility',
        path: `colors.theme.${mode}`,
        message: `Low contrast ratio (${contrast.toFixed(2)}) in ${mode} theme`,
        suggestion: 'Ensure text and background colors have sufficient contrast',
      });
    }
  }

  private checkColorContrastRatio(theme: ThemeConfig, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // 实现更详细的对比度检查
  }

  private checkTypographyReadability(theme: ThemeConfig, warnings: ValidationWarning[], recommendations: ValidationRecommendation[]): void {
    // 实现字体可读性检查
  }

  private checkInteractiveSizes(theme: ThemeConfig, warnings: ValidationWarning[], recommendations: ValidationRecommendation[]): void {
    // 实现交互元素大小检查
  }

  private checkShadowPerformance(theme: ThemeConfig, warnings: ValidationWarning[]): void {
    // 实现性能检查
  }

  private checkAnimationPerformance(theme: ThemeConfig, warnings: ValidationWarning[]): void {
    // 实现动画性能检查
  }

  private checkVisualPerformance(theme: ThemeConfig, recommendations: ValidationRecommendation[]): void {
    // 实现视觉效果性能检查
  }

  /**
   * 初始化验证规则
   */
  private initializeRules(): void {
    // 添加预定义的验证规则
  }

  /**
   * 添加自定义验证规则
   */
  public addRule(name: string, rule: ThemeValidationRule): void {
    this.rules.set(name, rule);
  }

  /**
   * 移除验证规则
   */
  public removeRule(name: string): void {
    this.rules.delete(name);
  }

  /**
   * 获取所有验证规则
   */
  public getRules(): ThemeValidationRule[] {
    return Array.from(this.rules.values());
  }
}