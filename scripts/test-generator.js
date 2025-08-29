#!/usr/bin/env node

/**
 * 测试生成器
 * 用于自动生成测试文件和测试用例
 */

import { join, dirname, basename } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试生成器配置
interface TestGeneratorConfig {
  framework: 'jest' | 'vitest';
  includeMocks: boolean;
  includeFixtures: boolean;
  testDir: string;
}

// 组件信息
interface ComponentInfo {
  name: string;
  path: string;
  type: 'component' | 'hook' | 'util' | 'service';
  exports: string[];
}

class TestGenerator {
  private config: TestGeneratorConfig;
  
  constructor(config: Partial<TestGeneratorConfig> = {}) {
    this.config = {
      framework: 'jest',
      includeMocks: true,
      includeFixtures: true,
      testDir: '__tests__',
      ...config
    };
  }
  
  /**
   * 为组件生成测试文件
   */
  async generateComponentTests(componentPath: string): Promise<void> {
    console.log(`Generating tests for: ${componentPath}`);
    
    // 解析组件信息
    const componentInfo = this.parseComponent(componentPath);
    
    // 生成测试文件内容
    const testContent = this.generateTestContent(componentInfo);
    
    // 确定测试文件路径
    const testFilePath = this.getTestFilePath(componentPath);
    
    // 写入测试文件
    this.writeTestFile(testFilePath, testContent);
    
    console.log(`Test file created: ${testFilePath}`);
    
    // 如果需要，生成 mock 文件
    if (this.config.includeMocks) {
      await this.generateMocks(componentInfo);
    }
    
    // 如果需要，生成 fixture 文件
    if (this.config.includeFixtures) {
      await this.generateFixtures(componentInfo);
    }
  }
  
  /**
   * 解析组件信息
   */
  private parseComponent(componentPath: string): ComponentInfo {
    const componentName = basename(componentPath, '.ts');
    const componentDir = dirname(componentPath);
    
    // 读取组件文件内容以分析导出
    let exports: string[] = [];
    try {
      const content = readFileSync(componentPath, 'utf-8');
      exports = this.extractExports(content);
    } catch (error) {
      console.warn(`Could not read component file: ${componentPath}`);
    }
    
    // 确定组件类型
    let type: ComponentInfo['type'] = 'util';
    if (componentPath.includes('component')) {
      type = 'component';
    } else if (componentPath.includes('hook')) {
      type = 'hook';
    } else if (componentPath.includes('service')) {
      type = 'service';
    }
    
    return {
      name: componentName,
      path: componentPath,
      type,
      exports
    };
  }
  
  /**
   * 提取导出信息
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // 匹配 export 语句
    const exportRegex = /export\s+(?:class|function|const|let)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // 匹配默认导出
    if (content.includes('export default')) {
      exports.push('default');
    }
    
    return exports;
  }
  
  /**
   * 生成测试文件内容
   */
  private generateTestContent(componentInfo: ComponentInfo): string {
    const { name, type, exports } = componentInfo;
    const componentName = name.charAt(0).toUpperCase() + name.slice(1);
    
    let testContent = '';
    
    // 添加文件头注释
    testContent += `/**\n`;
    testContent += ` * ${componentName} ${type === 'component' ? 'Component' : type.charAt(0).toUpperCase() + type.slice(1)} Tests\n`;
    testContent += ` */\n\n`;
    
    // 添加导入语句
    if (this.config.framework === 'jest') {
      testContent += `import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';\n`;
    } else {
      testContent += `import { describe, test, expect, beforeEach, afterEach } from 'vitest';\n`;
    }
    
    // 导入被测试的组件
    if (exports.includes('default')) {
      testContent += `import ${componentName}, { ${exports.filter(e => e !== 'default').join(', ')} } from '../${name}.js';\n\n`;
    } else {
      testContent += `import { ${exports.join(', ')} } from '../${name}.js';\n\n`;
    }
    
    // 添加 mock 导入（如果需要）
    if (this.config.includeMocks) {
      testContent += `// Mocks\n`;
      testContent += `import { createMock } from '../../test/mocks/index.js';\n\n`;
    }
    
    // 添加测试套件
    testContent += `describe('${componentName}', () => {\n`;
    testContent += `  beforeEach(() => {\n`;
    testContent += `    // Setup before each test\n`;
    testContent += `  });\n\n`;
    
    testContent += `  afterEach(() => {\n`;
    testContent += `    // Cleanup after each test\n`;
    testContent += `  });\n\n`;
    
    // 为每个导出生成测试用例
    for (const exportName of exports) {
      if (exportName === 'default' && exports.length > 1) {
        continue; // 默认导出会单独测试
      }
      
      const testName = exportName === 'default' ? componentName : exportName;
      testContent += `  describe('${testName}', () => {\n`;
      testContent += `    test('should be defined', () => {\n`;
      testContent += `      expect(${testName}).toBeDefined();\n`;
      testContent += `    });\n\n`;
      
      // 根据导出类型添加特定测试
      if (type === 'component') {
        testContent += `    test('should render correctly', () => {\n`;
        testContent += `      // TODO: Add rendering tests\n`;
        testContent += `    });\n\n`;
      } else if (type === 'hook') {
        testContent += `    test('should return expected values', () => {\n`;
        testContent += `      // TODO: Add hook tests\n`;
        testContent += `    });\n\n`;
      } else {
        testContent += `    test('should work correctly', () => {\n`;
        testContent += `      // TODO: Add functionality tests\n`;
        testContent += `    });\n\n`;
      }
      
      testContent += `  });\n\n`;
    }
    
    testContent += `});\n`;
    
    return testContent;
  }
  
  /**
   * 获取测试文件路径
   */
  private getTestFilePath(componentPath: string): string {
    const dir = dirname(componentPath);
    const fileName = basename(componentPath, '.ts');
    const testDir = join(dir, this.config.testDir);
    
    // 确保测试目录存在
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    return join(testDir, `${fileName}.test.ts`);
  }
  
  /**
   * 写入测试文件
   */
  private writeTestFile(filePath: string, content: string): void {
    writeFileSync(filePath, content, 'utf-8');
  }
  
  /**
   * 生成 mock 文件
   */
  private async generateMocks(componentInfo: ComponentInfo): Promise<void> {
    const { name } = componentInfo;
    const mockDir = join(dirname(componentInfo.path), '__mocks__');
    
    if (!existsSync(mockDir)) {
      mkdirSync(mockDir, { recursive: true });
    }
    
    const mockContent = this.generateMockContent(componentInfo);
    const mockFilePath = join(mockDir, `${name}.ts`);
    
    writeFileSync(mockFilePath, mockContent, 'utf-8');
    console.log(`Mock file created: ${mockFilePath}`);
  }
  
  /**
   * 生成 mock 文件内容
   */
  private generateMockContent(componentInfo: ComponentInfo): string {
    const { name, exports } = componentInfo;
    const componentName = name.charAt(0).toUpperCase() + name.slice(1);
    
    let mockContent = `/**\n`;
    mockContent += ` * Mock for ${componentName}\n`;
    mockContent += ` */\n\n`;
    
    mockContent += `// TODO: Implement mock for ${componentName}\n\n`;
    
    // 为每个导出创建 mock
    for (const exportName of exports) {
      if (exportName === 'default') {
        mockContent += `const ${name} = jest.fn();\n`;
      } else {
        mockContent += `export const ${exportName} = jest.fn();\n`;
      }
    }
    
    if (exports.includes('default')) {
      mockContent += `\nexport default ${name};\n`;
    }
    
    return mockContent;
  }
  
  /**
   * 生成 fixture 文件
   */
  private async generateFixtures(componentInfo: ComponentInfo): Promise<void> {
    const fixtureDir = join(process.cwd(), 'tests', 'fixtures');
    
    if (!existsSync(fixtureDir)) {
      mkdirSync(fixtureDir, { recursive: true });
    }
    
    const fixtureContent = this.generateFixtureContent(componentInfo);
    const fixtureFilePath = join(fixtureDir, `${componentInfo.name}.json`);
    
    writeFileSync(fixtureFilePath, fixtureContent, 'utf-8');
    console.log(`Fixture file created: ${fixtureFilePath}`);
  }
  
  /**
   * 生成 fixture 文件内容
   */
  private generateFixtureContent(componentInfo: ComponentInfo): string {
    const { name } = componentInfo;
    
    return JSON.stringify({
      id: `${name}-fixture-1`,
      name: `${name.charAt(0).toUpperCase() + name.slice(1)} Test Data`,
      createdAt: new Date().toISOString(),
      data: {
        // TODO: Add specific fixture data for this component
      }
    }, null, 2);
  }
  
  /**
   * 批量生成测试
   */
  async generateTestsForDirectory(directory: string): Promise<void> {
    console.log(`Generating tests for directory: ${directory}`);
    
    // 查找所有 TypeScript 文件
    const tsFiles = this.findTSFiles(directory);
    
    for (const file of tsFiles) {
      // 跳过已存在的测试文件
      if (file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }
      
      // 跳过测试目录中的文件
      if (file.includes('__tests__') || file.includes('__mocks__')) {
        continue;
      }
      
      try {
        await this.generateComponentTests(file);
      } catch (error) {
        console.error(`Failed to generate tests for ${file}:`, error);
      }
    }
  }
  
  /**
   * 查找 TypeScript 文件
   */
  private findTSFiles(directory: string): string[] {
    const files: string[] = [];
    
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      
      const items = readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = join(dir, item.name);
        
        if (item.isDirectory()) {
          walk(itemPath);
        } else if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
          files.push(itemPath);
        }
      }
    };
    
    walk(directory);
    return files;
  }
}

// 读取目录内容的辅助函数
function readdirSync(dir: string, options: { withFileTypes: true }): any[] {
  try {
    return require('fs').readdirSync(dir, options);
  } catch {
    return [];
  }
}

// 运行测试生成器
async function run(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: pnpm test:generate <component-path|directory>');
    console.log('Examples:');
    console.log('  pnpm test:generate src/components/Button.ts');
    console.log('  pnpm test:generate src/components');
    process.exit(1);
  }
  
  const target = args[0];
  const generator = new TestGenerator();
  
  try {
    if (existsSync(target) && (target.endsWith('.ts') || target.endsWith('.tsx'))) {
      // 为单个组件生成测试
      await generator.generateComponentTests(target);
    } else if (existsSync(target) && require('fs').statSync(target).isDirectory()) {
      // 为整个目录生成测试
      await generator.generateTestsForDirectory(target);
    } else {
      console.error(`Target not found: ${target}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to generate tests:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  run();
}

export default TestGenerator;