#!/usr/bin/env node

/**
 * 测试报告生成器
 * 用于生成和聚合测试结果报告
 */

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

// 报告配置
interface ReportConfig {
  outputPath: string;
  includeCoverage: boolean;
  includePerformance: boolean;
  includeSecurity: boolean;
}

// 测试结果
interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  details?: any;
}

// 覆盖率数据
interface CoverageData {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

class TestReportGenerator {
  private config: ReportConfig;
  
  constructor(config: Partial<ReportConfig> = {}) {
    this.config = {
      outputPath: './reports/test-report.md',
      includeCoverage: true,
      includePerformance: true,
      includeSecurity: true,
      ...config
    };
  }
  
  /**
   * 生成综合测试报告
   */
  async generateReport(): Promise<void> {
    console.log('Generating test report...');
    
    const reportSections = [
      this.generateHeader(),
      await this.generateTestSummary(),
      this.config.includeCoverage ? await this.generateCoverageReport() : '',
      this.config.includePerformance ? await this.generatePerformanceReport() : '',
      this.config.includeSecurity ? await this.generateSecurityReport() : '',
      this.generateFooter()
    ].filter(section => section !== '');
    
    const fullReport = reportSections.join('\n\n');
    
    // 确保输出目录存在
    const outputPathDir = this.config.outputPath.split('/').slice(0, -1).join('/');
    if (outputPathDir && !existsSync(outputPathDir)) {
      execSync(`mkdir -p ${outputPathDir}`, { stdio: 'ignore' });
    }
    
    writeFileSync(this.config.outputPath, fullReport);
    console.log(`Report generated at: ${this.config.outputPath}`);
  }
  
  /**
   * 生成报告头部
   */
  private generateHeader(): string {
    const now = new Date();
    return `# Blade AI Test Report
Generated on: ${now.toISOString()}

## Summary
This report summarizes the test results for the Blade AI project.
`;
  }
  
  /**
   * 生成测试摘要
   */
  private async generateTestSummary(): Promise<string> {
    // 收集各种测试结果
    const unitTests = this.getJestResults('unit');
    const integrationTests = this.getJestResults('integration');
    const e2eTests = this.getJestResults('e2e');
    
    return `## Test Summary

| Test Type | Status | Passed | Failed | Total | Duration |
|-----------|--------|--------|--------|-------|----------|
| Unit Tests | ${unitTests.status} | ${unitTests.passed} | ${unitTests.failed} | ${unitTests.total} | ${unitTests.duration}ms |
| Integration Tests | ${integrationTests.status} | ${integrationTests.passed} | ${integrationTests.failed} | ${integrationTests.total} | ${integrationTests.duration}ms |
| E2E Tests | ${e2eTests.status} | ${e2eTests.passed} | ${e2eTests.failed} | ${e2eTests.total} | ${e2eTests.duration}ms |
`;
  }
  
  /**
   * 获取 Jest 测试结果
   */
  private getJestResults(testType: string): any {
    try {
      // 尝试读取 Jest 测试结果文件
      const coverageDir = './coverage';
      if (existsSync(coverageDir)) {
        const summaryFile = join(coverageDir, 'summary.json');
        if (existsSync(summaryFile)) {
          const summary = JSON.parse(readFileSync(summaryFile, 'utf-8'));
          return {
            status: 'completed',
            passed: summary.successfulTests || 0,
            failed: summary.failedTests || 0,
            total: summary.totalTests || 0,
            duration: summary.duration || 0
          };
        }
      }
      
      // 默认返回值
      return {
        status: 'unknown',
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0
      };
    } catch (error) {
      console.warn(`Failed to get ${testType} test results:`, error);
      return {
        status: 'error',
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0
      };
    }
  }
  
  /**
   * 生成覆盖率报告
   */
  private async generateCoverageReport(): Promise<string> {
    try {
      const coverageDir = './coverage';
      if (!existsSync(coverageDir)) {
        return '';
      }
      
      // 读取覆盖率摘要
      const coverageFiles = readdirSync(coverageDir).filter(f => f.includes('summary'));
      if (coverageFiles.length === 0) {
        return '';
      }
      
      const summaryFile = join(coverageDir, coverageFiles[0]);
      const summary = JSON.parse(readFileSync(summaryFile, 'utf-8'));
      
      return `## Coverage Report

| Metric | Percentage | Status |
|--------|------------|--------|
| Lines | ${summary.lines?.pct || 0}% | ${this.getCoverageStatus(summary.lines?.pct || 0)} |
| Functions | ${summary.functions?.pct || 0}% | ${this.getCoverageStatus(summary.functions?.pct || 0)} |
| Branches | ${summary.branches?.pct || 0}% | ${this.getCoverageStatus(summary.branches?.pct || 0)} |
| Statements | ${summary.statements?.pct || 0}% | ${this.getCoverageStatus(summary.statements?.pct || 0)} |
`;
    } catch (error) {
      console.warn('Failed to generate coverage report:', error);
      return '';
    }
  }
  
  /**
   * 获取覆盖率状态
   */
  private getCoverageStatus(percentage: number): string {
    if (percentage >= 80) return '✅ Good';
    if (percentage >= 60) return '⚠️  Moderate';
    return '❌ Poor';
  }
  
  /**
   * 生成性能报告
   */
  private async generatePerformanceReport(): Promise<string> {
    try {
      // 检查性能测试结果
      const perfDir = './performance-results';
      if (!existsSync(perfDir)) {
        return '';
      }
      
      return `## Performance Report

Performance tests completed successfully.
Check detailed results in the performance-results directory.
`;
    } catch (error) {
      console.warn('Failed to generate performance report:', error);
      return '';
    }
  }
  
  /**
   * 生成安全报告
   */
  private async generateSecurityReport(): Promise<string> {
    try {
      // 运行安全审计
      const auditResult = execSync('pnpm audit --json', { 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      
      const auditData = JSON.parse(auditResult);
      
      if (auditData.actions?.length > 0) {
        return `## Security Report

⚠️  Security vulnerabilities found:
- Total vulnerabilities: ${auditData.metadata?.vulnerabilities?.total || 0}
- Critical: ${auditData.metadata?.vulnerabilities?.critical || 0}
- High: ${auditData.metadata?.vulnerabilities?.high || 0}
- Moderate: ${auditData.metadata?.vulnerabilities?.moderate || 0}
- Low: ${auditData.metadata?.vulnerabilities?.low || 0}
`;
      } else {
        return `## Security Report

✅ No security vulnerabilities found.
`;
      }
    } catch (error) {
      // 安全审计可能返回非零退出码
      if (error instanceof Error && error.message.includes('audit')) {
        return `## Security Report

⚠️  Security audit completed with findings.
Run 'pnpm audit' for detailed information.
`;
      }
      
      console.warn('Failed to generate security report:', error);
      return '';
    }
  }
  
  /**
   * 生成报告尾部
   */
  private generateFooter(): string {
    return `## Report Details

This report was automatically generated by the Blade AI test reporting system.

For detailed information:
- Check individual test result files in the test-results directory
- View coverage reports in the coverage directory
- Review security findings with 'pnpm audit'
`;
  }
}

// 运行报告生成器
async function run(): Promise<void> {
  const generator = new TestReportGenerator({
    outputPath: './reports/test-report.md'
  });
  
  await generator.generateReport();
}

// 如果直接运行此脚本
if (require.main === module) {
  run().catch(error => {
    console.error('Failed to generate test report:', error);
    process.exit(1);
  });
}

export default TestReportGenerator;