import chalk from 'chalk';
import { Command } from 'commander';
import { Agent, LoggerComponent } from '../agent/index.js';

// 测试文件监听
/**
 * 注册运行命令
 */
export function runCommand(program: Command) {
  program
    .command('run')
    .description('运行 Agent')
    .option('-d, --debug', '启用调试模式', false)
    .action(async (options) => {
      console.log(chalk.blue('🚀 启动 Agent...'));
      
      try {
        // 创建 Agent 实例
        const agent = new Agent({ debug: options.debug });
        
        // 创建并注册日志组件
        const logLevel = options.debug ? 'debug' : 'info';
        const logger = new LoggerComponent(logLevel);
        agent.registerComponent(logger);
        
        // 初始化 Agent
        await agent.init();
        
        // 获取日志组件并使用
        const loggerComponent = agent.getComponent<LoggerComponent>('logger');
        if (loggerComponent) {
          loggerComponent.info('Agent 已准备就绪');
          loggerComponent.debug('这是一条调试信息，仅在调试模式下可见');
        }
        
        // 运行 Agent
        await agent.run();
        
        // 模拟用户交互
        const userInput = await agent.handleInput('请输入一条消息:');
        agent.output(`您输入的消息是: ${userInput}`, 'success');
        
        // 停止 Agent
        await agent.stop();
        
        // 清理资源
        await agent.destroy();
        
        console.log(chalk.green('✅ Agent 已成功停止'));
      } catch (error) {
        console.error(chalk.red('❌ Agent 运行出错:'), error);
      }
    });
} 