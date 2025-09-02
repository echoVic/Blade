#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { E2E_TEST_SCENARIOS } from './test-scenarios.js';

class E2ETestRunner {
  constructor() {
    this.results = [];
    this.baselineMode = process.argv.includes('--baseline');
    this.compareMode = process.argv.includes('--compare');
    this.baselineFile = join(process.cwd(), 'e2e-baseline.json');
  }

  async runTestScenario(scenario) {
    return new Promise((resolve, reject) => {
      const bladeProcess = spawn('node', [join(process.cwd(), 'bin', 'blade.js')], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      const scenarioResults = [];

      bladeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(`[OUTPUT] ${text.trim()}`);
      });

      bladeProcess.stderr.on('data', (data) => {
        console.error(`[ERROR] ${data.toString()}`);
      });

      bladeProcess.on('close', (code) => {
        console.log(`进程退出，代码: ${code}`);
        resolve(scenarioResults);
      });

      // 等待初始启动完成
      setTimeout(async () => {
        for (const command of scenario.commands) {
          try {
            console.log(`[INPUT] ${command.input}`);
            bladeProcess.stdin.write(command.input + '\n');
            
            // 等待响应
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const result = {
              command: command.input,
              output: output,
              matched: command.expected.test(output)
            };
            
            scenarioResults.push(result);
            output = ''; // 清空输出以进行下一个命令
            
          } catch (error) {
            console.error(`命令执行错误: ${error}`);
          }
        }
        
        bladeProcess.stdin.write('\x03'); // Ctrl+C 退出
      }, 1000);
    });
  }

  async runAllTests() {
    console.log('🚀 开始 E2E 功能完整性测试\n');

    for (const scenario of E2E_TEST_SCENARIOS) {
      console.log(`📋 测试场景: ${scenario.name}`);
      const results = await this.runTestScenario(scenario);
      
      const scenarioResult = {
        scenario: scenario.name,
        results: results,
        passed: results.every(r => r.matched)
      };
      
      this.results.push(scenarioResult);
      console.log(`✅ 场景完成: ${scenarioResult.passed ? '通过' : '失败'}\n`);
    }

    this.printSummary();
    
    if (this.baselineMode) {
      this.saveBaseline();
    }
  }

  printSummary() {
    console.log('📊 E2E 测试总结:');
    console.log('='.repeat(50));
    
    let totalPassed = 0;
    let totalCommands = 0;
    
    this.results.forEach(result => {
      const passedCommands = result.results.filter(r => r.matched).length;
      totalPassed += passedCommands;
      totalCommands += result.results.length;
      
      console.log(`${result.scenario}: ${passedCommands}/${result.results.length} 命令通过`);
    });
    
    console.log('='.repeat(50));
    console.log(`总计: ${totalPassed}/${totalCommands} 命令通过`);
    console.log(`成功率: ${((totalPassed / totalCommands) * 100).toFixed(1)}%`);
  }

  saveBaseline() {
    const baselineData = this.results.map(result => ({
      scenario: result.scenario,
      expectedOutputs: result.results.map(r => ({
        command: r.command,
        outputPattern: r.output
      }))
    }));
    
    writeFileSync(this.baselineFile, JSON.stringify(baselineData, null, 2));
    console.log(`📝 基线数据已保存到: ${this.baselineFile}`);
  }

  async compareWithBaseline() {
    if (!this.compareMode) return;
    
    try {
      const baselineData = JSON.parse(readFileSync(this.baselineFile, 'utf8'));
      console.log('🔍 开始与基线数据比较...');
      
      // 实现比较逻辑
      // ...
      
    } catch (error) {
      console.error('无法读取基线数据:', error);
    }
  }
}

// 运行测试
const runner = new E2ETestRunner();
runner.runAllTests().catch(console.error);