import chalk from 'chalk';
import * as events from 'events';
import inquirer from 'inquirer';

/**
 * 组件接口
 */
export interface Component {
  name: string;
  init(): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Agent 配置选项
 */
export interface AgentOptions {
  debug?: boolean;
  components?: Component[];
}

/**
 * Agent 主类 - 负责协调各组件工作，管理生命周期，处理用户输入和输出
 */
export class Agent extends events.EventEmitter {
  private components: Map<string, Component> = new Map();
  private initialized: boolean = false;
  private debug: boolean;
  
  /**
   * 创建 Agent 实例
   */
  constructor(options: AgentOptions = {}) {
    super();
    this.debug = options.debug || false;
    
    // 注册初始组件
    if (options.components) {
      options.components.forEach(component => {
        this.registerComponent(component);
      });
    }
  }
  
  /**
   * 注册组件
   */
  public registerComponent(component: Component): void {
    if (this.components.has(component.name)) {
      this.log('warn', `组件 "${component.name}" 已存在，将被覆盖`);
    }
    
    this.components.set(component.name, component);
    this.log('info', `组件 "${component.name}" 已注册`);
  }
  
  /**
   * 获取已注册组件
   */
  public getComponent<T extends Component>(name: string): T | undefined {
    return this.components.get(name) as T | undefined;
  }
  
  /**
   * 初始化 Agent 及所有组件
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      this.log('warn', 'Agent 已经初始化');
      return;
    }
    
    this.log('info', '初始化 Agent...');
    
    try {
      // 初始化所有组件
      const entries = Array.from(this.components.entries());
      for (const [name, component] of entries) {
        this.log('info', `初始化组件: ${name}`);
        await component.init();
      }
      
      this.initialized = true;
      this.emit('initialized');
      this.log('success', 'Agent 初始化完成');
    } catch (error) {
      this.log('error', `初始化失败: ${error}`);
      throw error;
    }
  }
  
  /**
   * 销毁 Agent 及所有组件
   */
  public async destroy(): Promise<void> {
    if (!this.initialized) {
      this.log('warn', 'Agent 尚未初始化');
      return;
    }
    
    this.log('info', '销毁 Agent...');
    
    try {
      // 按注册的相反顺序销毁组件
      const componentsArray = Array.from(this.components.entries());
      for (let i = componentsArray.length - 1; i >= 0; i--) {
        const [name, component] = componentsArray[i];
        this.log('info', `销毁组件: ${name}`);
        await component.destroy();
      }
      
      this.initialized = false;
      this.emit('destroyed');
      this.log('success', 'Agent 已销毁');
    } catch (error) {
      this.log('error', `销毁失败: ${error}`);
      throw error;
    }
  }
  
  /**
   * 处理用户输入
   */
  public async handleInput(prompt: string): Promise<string> {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'userInput',
        message: prompt
      }
    ]);
    
    this.emit('userInput', answer.userInput);
    return answer.userInput;
  }
  
  /**
   * 处理输出到用户
   */
  public output(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
    let formattedMessage: string;
    
    switch (type) {
      case 'success':
        formattedMessage = chalk.green(message);
        break;
      case 'warn':
        formattedMessage = chalk.yellow(message);
        break;
      case 'error':
        formattedMessage = chalk.red(message);
        break;
      default:
        formattedMessage = chalk.blue(message);
    }
    
    console.log(formattedMessage);
    this.emit('output', { message, type });
  }
  
  /**
   * 内部日志方法
   */
  private log(type: 'info' | 'success' | 'warn' | 'error', message: string): void {
    if (this.debug || type === 'error') {
      this.output(`[Agent] ${message}`, type);
    }
  }
  
  /**
   * 运行 Agent
   */
  public async run(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
    
    this.log('info', 'Agent 开始运行');
    this.emit('running');
    
    // 这里可以添加具体的运行逻辑
  }
  
  /**
   * 停止 Agent
   */
  public async stop(): Promise<void> {
    this.log('info', 'Agent 停止运行');
    this.emit('stopped');
    
    // 这里可以添加停止逻辑，但不销毁组件
  }
} 