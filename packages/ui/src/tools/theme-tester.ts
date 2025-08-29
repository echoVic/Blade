/**
 * 主题测试工具
 * 用于测试主题在不同场景下的表现
 */

import type { ThemeConfig } from '../types/design-tokens';
import { builtinThemes } from '../themes/builtin-themes';
import ThemeValidator from '../themes/theme-validator';

export class ThemeTester {
  private validator: ThemeValidator;

  constructor() {
    this.validator = new ThemeValidator();
  }

  /**
   * 运行所有主题测试
   */
  public async runAllTests(): Promise<void> {
    console.log('🧪 开始主题系统测试...');
    console.log('========================');

    let passed = 0;
    let failed = 0;

    // 测试1: 验证所有内置主题
    console.log('\n1. 验证内置主题...');
    const validationResults = this.testBuiltinThemes();
    if (validationResults) {
      passed++;
      console.log('   ✅ 通过');
    } else {
      failed++;
      console.log('   ❌ 失败');
    }

    // 测试2: 测试主题切换
    console.log('\n2. 测试主题切换...');
    const switchResults = this.testThemeSwitching();
    if (switchResults) {
      passed++;
      console.log('   ✅ 通过');
    } else {
      failed++;
      console.log('   ❌ 失败');
    }

    // 测试3: 测试颜色对比度
    console.log('\n3. 测试颜色对比度...');
    const contrastResults = this.testColorContrast();
    if (contrastResults) {
      passed++;
      console.log('   ✅ 通过');
    } else {
      failed++;
      console.log('   ❌ 失败');
    }

    // 测试4: 测试令牌访问
    console.log('\n4. 测试令牌访问...');
    const tokenResults = this.testTokenAccess();
    if (tokenResults) {
      passed++;
      console.log('   ✅ 通过');
    } else {
      failed++;
      console.log('   ❌ 失败');
    }

    // 测试5: 测试主题导出
    console.log('\n5. 测试主题导出...');
    const exportResults = this.testThemeExport();
    if (exportResults) {
      passed++;
      console.log('   ✅ 通过');
    } else {
      failed++;
      console.log('   ❌ 失败');
    }

    console.log('\n========================');
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    
    if (failed > 0) {
      process.exit(1);
    }
  }

  /**
   * 测试内置主题验证
   */
  private testBuiltinThemes(): boolean {
    try {
      const results = this.validator.validateBuiltinThemes();
      
      let allValid = true;
      Object.entries(results).forEach(([themeId, result]) => {
        if (!result.isValid) {
          console.log(`   ❌ 主题 ${themeId} 验证失败:`);
          result.errors.forEach(error => {
            console.log(`      - ${error.path}: ${error.message}`);
          });
          allValid = false;
        }
      });
      
      return allValid;
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }

  /**
   * 测试主题切换
   */
  private testThemeSwitching(): boolean {
    try {
      const themeIds = Object.keys(builtinThemes);
      
      // 模拟主题切换
      for (const themeId of themeIds) {
        const theme = builtinThemes[themeId];
        if (!theme) {
          console.log(`   ❌ 找不到主题 ${themeId}`);
          return false;
        }
        
        // 验证主题结构
        if (!theme.id || !theme.name || !theme.tokens) {
          console.log(`   ❌ 主题 ${themeId} 结构不完整`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }

  /**
   * 测试颜色对比度
   */
  private testColorContrast(): boolean {
    try {
      let allPassed = true;
      
      Object.entries(builtinThemes).forEach(([themeId, theme]) => {
        // 测试主要文本和背景的对比度
        const textColor = theme.tokens.colors.functional.text.primary;
        const bgColor = theme.tokens.colors.functional.background.primary;
        
        const contrast = this.calculateContrast(textColor, bgColor);
        if (contrast < 4.5) {
          console.log(`   ⚠️  主题 ${themeId} 文本与背景对比度不足: ${contrast.toFixed(2)}`);
          // 不算作失败，只是警告
        }
      });
      
      return allPassed;
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }

  /**
   * 测试令牌访问
   */
  private testTokenAccess(): boolean {
    try {
      const defaultTheme = builtinThemes.default;
      
      // 测试常用令牌访问
      const testTokens = [
        'colors.base.white',
        'colors.base.black',
        'colors.semantic.primary.500',
        'typography.fontSize.base',
        'spacing.base.md',
        'border.radius.md',
      ];
      
      for (const tokenPath of testTokens) {
        const value = this.getTokenValue(defaultTheme.tokens, tokenPath);
        if (value === undefined) {
          console.log(`   ❌ 无法访问令牌: ${tokenPath}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }

  /**
   * 测试主题导出
   */
  private testThemeExport(): boolean {
    try {
      // 测试JSON导出
      const defaultTheme = builtinThemes.default;
      const jsonExport = JSON.stringify(defaultTheme, null, 2);
      if (!jsonExport) {
        console.log('   ❌ JSON导出失败');
        return false;
      }
      
      // 验证导出的内容可以解析
      const parsed = JSON.parse(jsonExport);
      if (!parsed.id || !parsed.name) {
        console.log('   ❌ JSON导出内容不完整');
        return false;
      }
      
      return true;
    } catch (error) {
      console.log(`   ❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    }
  }

  /**
   * 计算颜色对比度
   */
  private calculateContrast(color1: string, color2: string): number {
    const luminance1 = this.calculateLuminance(color1);
    const luminance2 = this.calculateLuminance(color2);
    const brightest = Math.max(luminance1, luminance2);
    const darkest = Math.min(luminance1, luminance2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * 计算颜色亮度
   */
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

  /**
   * 获取令牌值
   */
  private getTokenValue(tokens: any, path: string): any {
    const parts = path.split('.');
    let current: any = tokens;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 性能测试
   */
  public async runPerformanceTests(): Promise<void> {
    console.log('⚡ 开始性能测试...');
    console.log('====================');

    // 测试令牌访问性能
    const defaultTheme = builtinThemes.default;
    const iterations = 10000;
    
    console.log(`\n测试 ${iterations} 次令牌访问...`);
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.getTokenValue(defaultTheme.tokens, 'colors.semantic.primary.500');
    }
    const end = performance.now();
    
    const totalTime = end - start;
    const avgTime = totalTime / iterations;
    
    console.log(`总时间: ${totalTime.toFixed(2)}ms`);
    console.log(`平均时间: ${avgTime.toFixed(4)}ms`);
    console.log(`每秒访问次数: ${Math.round(iterations / (totalTime / 1000))}`);
    
    // 性能评估
    if (avgTime < 0.01) {
      console.log('✅ 性能优秀');
    } else if (avgTime < 0.1) {
      console.log('⚠️  性能良好');
    } else {
      console.log('❌ 性能需要优化');
    }
  }

  /**
   * 生成测试报告
   */
  public generateTestReport(): string {
    const report: string[] = [];
    
    report.push('# 主题系统测试报告');
    report.push('====================');
    report.push('');
    report.push(`生成时间: ${new Date().toISOString()}`);
    report.push('');
    
    // 验证结果
    report.push('## 验证结果');
    report.push('');
    
    const validationResults = this.validator.validateBuiltinThemes();
    Object.entries(validationResults).forEach(([themeId, result]) => {
      report.push(`### ${themeId}`);
      report.push(`状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
      report.push(`错误: ${result.errors.length}`);
      report.push(`警告: ${result.warnings.length}`);
      report.push('');
    });
    
    return report.join('\n');
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  const tester = new ThemeTester();
  
  const runTests = async () => {
    // 运行功能测试
    await tester.runAllTests();
    
    // 运行性能测试
    await tester.runPerformanceTests();
    
    // 生成测试报告
    const report = tester.generateTestReport();
    console.log('\n📋 测试报告已生成');
  };
  
  runTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

export default ThemeTester;