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
} from '../types/design-tokens';
import type { DesignTokens } from '../types/design-tokens';
import { builtinThemes } from './builtin-themes';

export class ThemeValidator {
  private validationLevel: 'strict' | 'normal' | 'loose';
  private customRules: ValidationRule[] = [];

  constructor(validationLevel: 'strict' | 'normal' | 'loose' = 'normal') {
    this.validationLevel = validationLevel;
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

    // 运行自定义规则
    for (const rule of this.customRules) {
      const ruleResult = rule.validate(theme);
      errors.push(...ruleResult.errors);
      warnings.push(...ruleResult.warnings);
      recommendations.push(...ruleResult.recommendations);
    }

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
      });
    } else if (!this.isValidColor(colors.base.white)) {
      errors.push({
        type: 'format',
        path: 'colors.base.white',
        message: 'White color must be a valid hex color',
        value: colors.base.white,
      });
    }

    if (!colors.base.black) {
      errors.push({
        type: 'required',
        path: 'colors.base.black',
        message: 'Black color is required',
        value: undefined,
      });
    } else if (!this.isValidColor(colors.base.black)) {
      errors.push({
        type: 'format',
        path: 'colors.base.black',
        message: 'Black color must be a valid hex color',
        value: colors.base.black,
      });
    }

    // 验证调色板
    this.validateColorPalette('colors.base.gray', colors.base.gray, errors, warnings);
    this.validateColorPalette('colors.base.neutral', colors.base.neutral, errors, warnings);

    // 验证语义化颜色
    this.validateColorScale('colors.semantic.primary', colors.semantic.primary, errors, warnings);
    this.validateColorScale('colors.semantic.secondary', colors.semantic.secondary, errors, warnings);
    this.validateColorScale('colors.semantic.accent', colors.semantic.accent, errors, warnings);
    this.validateColorScale('colors.semantic.success', colors.semantic.success, errors, warnings);
    this.validateColorScale('colors.semantic.warning', colors.semantic.warning, errors, warnings);
    this.validateColorScale('colors.semantic.error', colors.semantic.error, errors, warnings);
    this.validateColorScale('colors.semantic.info', colors.semantic.info, errors, warnings);

    // 验证功能性颜色
    errors.push(...this.validateFunctionalColors(colors.functional));

    // 验证主题颜色
    errors.push(...this.validateThemeColors(colors.theme));

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
      });
    }

    if (!typography.fontFamily.mono || typography.fontFamily.mono.length === 0) {
      errors.push({
        type: 'required',
        path: 'typography.fontFamily.mono',
        message: 'Monospace font family is required',
        value: typography.fontFamily.mono,
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
        });
        break;
      }
    }

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
      });
    }

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
        });
      }
    }

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

    // 渐变格式验证
    Object.entries(gradient.linear).forEach(([key, value]) => {
      if (!this.isValidGradient(value)) {
        errors.push({
          type: 'format',
          path: `gradient.linear.${key}`,
          message: 'Invalid linear gradient format',
          value: value,
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
      });
    }

    if (!theme.name) {
      errors.push({
        type: 'required',
        path: 'name',
        message: 'Theme name is required',
        value: theme.name,
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
        });
      } else if (!this.isValidColor(color)) {
        errors.push({
          type: 'format',
          path: colorPath,
          message: `Color step ${step} must be a valid hex color`,
          value: color,
        });
      }
    });
  }

  /**
   * 验证颜色色阶
   */
  private validateColorScale(path: string, scale: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    this.validateColorPalette(path, scale, errors, warnings);
  }

  /**
   * 验证功能性颜色
   */
  private validateFunctionalColors(functional: DesignTokens['colors']['functional']): ValidationError[] {
    const errors: ValidationError[] = [];

    // 验证必需的颜色属性
    const requiredPaths = [
      'background.primary',
      'background.secondary',
      'text.primary',
      'text.secondary',
      'border.default',
    ];

    requiredPaths.forEach(path => {
      const parts = path.split('.');
      const value = functional[parts[0] as keyof typeof functional][parts[1] as keyof any];
      
      if (!value) {
        errors.push({
          type: 'required',
          path: `colors.functional.${path}`,
          message: `${path} is required`,
          value: undefined,
        });
      } else if (!this.isValidColor(value)) {
        errors.push({
          type: 'format',
          path: `colors.functional.${path}`,
          message: `${path} must be a valid hex color`,
          value: value,
        });
      }
    });

    return errors;
  }

  /**
   * 验证主题颜色
   */
  private validateThemeColors(themeColors: DesignTokens['colors']['theme']): ValidationError[] {
    const errors: ValidationError[] = [];

    // 验证亮色主题颜色
    Object.entries(themeColors.light).forEach(([key, value]) => {
      if (!this.isValidColor(value)) {
        errors.push({
          type: 'format',
          path: `colors.theme.light.${key}`,
          message: `Light theme ${key} must be a valid hex color`,
          value: value,
        });
      }
    });

    // 验证暗色主题颜色
    Object.entries(themeColors.dark).forEach(([key, value]) => {
      if (!this.isValidColor(value)) {
        errors.push({
          type: 'format',
          path: `colors.theme.dark.${key}`,
          message: `Dark theme ${key} must be a valid hex color`,
          value: value,
        });
      }
    });

    return errors;
  }

  /**
   * 验证主题一致性
   */
  private checkThemeConsistency(theme: ThemeConfig, errors: ValidationError[], warnings: ValidationWarning[]): void {
    // 检查主题ID和名称的一致性
    if (theme.id && theme.name && !theme.id.toLowerCase().includes(theme.name.toLowerCase().replace(/\s+/g, '-'))) {
      warnings.push({
        type: 'recommendation',
        path: 'id',
        message: 'Theme ID should be related to theme name',
      });
    }
  }

  /**
   * 工具方法
   */

  private isValidColor(color: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  private isValidBoxShadow(shadow: string): boolean {
    return shadow === 'none' || /rgba?\([^)]+\)/.test(shadow);
  }

  private isValidGradient(gradient: string): boolean {
    return /^linear-gradient|^radial-gradient|^conic-gradient/i.test(gradient);
  }

  /**
   * 添加自定义验证规则
   */
  public addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * 移除验证规则
   */
  public removeRule(name: string): void {
    this.customRules = this.customRules.filter(rule => rule.name !== name);
  }

  /**
   * 验证所有内置主题
   */
  public validateBuiltinThemes(): Record<string, ThemeValidationResult> {
    const results: Record<string, ThemeValidationResult> = {};
    
    Object.entries(builtinThemes).forEach(([themeId, theme]) => {
      results[themeId] = this.validateTheme(theme);
    });
    
    return results;
  }

  /**
   * 获取验证报告
   */
  public getValidationReport(theme: ThemeConfig): string {
    const result = this.validateTheme(theme);
    
    let report = `Theme Validation Report for "${theme.name}"\n`;
    report += '='.repeat(50) + '\n\n';
    
    report += `Status: ${result.isValid ? 'VALID' : 'INVALID'}\n`;
    report += `Errors: ${result.errors.length}\n`;
    report += `Warnings: ${result.warnings.length}\n`;
    report += `Recommendations: ${result.recommendations.length}\n\n`;
    
    if (result.errors.length > 0) {
      report += 'Errors:\n';
      result.errors.forEach(error => {
        report += `  - ${error.path}: ${error.message}\n`;
      });
      report += '\n';
    }
    
    if (result.warnings.length > 0) {
      report += 'Warnings:\n';
      result.warnings.forEach(warning => {
        report += `  - ${warning.path}: ${warning.message}\n`;
      });
      report += '\n';
    }
    
    if (result.recommendations.length > 0) {
      report += 'Recommendations:\n';
      result.recommendations.forEach(rec => {
        report += `  - ${rec.path}: ${rec.message}\n`;
      });
      report += '\n';
    }
    
    return report;
  }
}

/**
 * 验证规则接口
 */
export interface ValidationRule {
  name: string;
  validate(theme: ThemeConfig): ThemeValidationResult;
}

/**
 * 颜色对比度验证规则
 */
export class ColorContrastRule implements ValidationRule {
  name = 'color-contrast';
  
  validate(theme: ThemeConfig): ThemeValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: ValidationRecommendation[] = [];

    // 检查文本和背景颜色的对比度
    const textColors = [
      theme.tokens.colors.functional.text.primary,
      theme.tokens.colors.functional.text.secondary,
    ];
    
    const backgroundColors = [
      theme.tokens.colors.functional.background.primary,
      theme.tokens.colors.functional.background.secondary,
    ];

    textColors.forEach((textColor, i) => {
      backgroundColors.forEach((bgColor, j) => {
        const contrast = this.calculateContrast(textColor, bgColor);
        if (contrast < 4.5) {
          warnings.push({
            type: 'accessibility',
            path: `colors.functional.text.primary vs colors.functional.background.primary`,
            message: `Low contrast ratio (${contrast.toFixed(2)}) between text and background`,
          });
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  private calculateContrast(color1: string, color2: string): number {
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
}

export default ThemeValidator;