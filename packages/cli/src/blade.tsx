
import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import { useMemoizedFn } from 'ahooks';
import { Command } from 'commander';

// --- UI Components & Contexts ---
import { SessionProvider, useSession } from './contexts/SessionContext.js';
import { EnhancedReplInterface } from './components/EnhancedReplInterface.js';
import { CommandOrchestrator, CommandResult } from './services/CommandOrchestrator.js';
import { ConfigService } from './config/ConfigService.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

// --- Command Definitions ---
import { agentLlmCommand } from './commands/agent-llm.js';
import { configCommand } from './commands/config.js';
import { llmCommand } from './commands/llm.js';
import { mcpCommand } from './commands/mcp.js';
import { toolsCommand } from './commands/tools.js';

interface BladeAppProps {
  config?: any;
  debug?: boolean;
}

const BladeAppInner: React.FC<BladeAppProps> = ({ config, debug = false }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [commandOrchestrator, setCommandOrchestrator] = useState<CommandOrchestrator | null>(null);
  const [configService] = useState(() => ConfigService.getInstance());
  const { addAssistantMessage, addUserMessage, clearMessages, resetSession } = useSession();
  const { exit } = useApp();

  const initializeApp = useMemoizedFn(async () => {
    try {
      await configService.initialize();
      const config = configService.getConfig();
      
      // 检查API Key配置
      if (!config.auth.apiKey || config.auth.apiKey.trim() === '') {
        setIsInitialized(true);
        addAssistantMessage('🚀 欢迎使用 Blade AI 助手！');
        addAssistantMessage('');
        addAssistantMessage('⚠️  检测到尚未配置 API 密钥');
        addAssistantMessage('');
        addAssistantMessage('📝 请使用以下方式之一配置API密钥：');
        addAssistantMessage('');
        addAssistantMessage('方式1: 环境变量');
        addAssistantMessage('export BLADE_API_KEY="your-api-key"');
        addAssistantMessage('');
        addAssistantMessage('方式2: 配置文件');
        addAssistantMessage('编辑 ~/.blade/config.json，设置 auth.apiKey');
        addAssistantMessage('');
        addAssistantMessage('💡 配置完成后输入任何消息即可开始对话');
        return;
      }

      const orchestrator = CommandOrchestrator.getInstance();
      await orchestrator.initialize();
      setCommandOrchestrator(orchestrator);
      setIsInitialized(true);
      addAssistantMessage('🚀 Blade AI 助手已启动！输入 /help 查看可用命令，或直接提问。');
    } catch (error) {
      addAssistantMessage(`❌ 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  });

  const handleCommandSubmit = useMemoizedFn(async (input: string): Promise<CommandResult> => {
    addUserMessage(input);
    
    // 如果没有初始化orchestrator，尝试重新初始化（用于API Key配置后的首次使用）
    if (!commandOrchestrator) {
      try {
        // 重新加载配置以获取最新的API密钥
        await configService.reload();
        const config = configService.getConfig();
        if (!config.auth.apiKey) {
          addAssistantMessage('❌ 仍未检测到API密钥，请先配置API密钥');
          return { success: false, error: 'API密钥未配置' };
        }
        
        // 重新初始化
        const orchestrator = CommandOrchestrator.getInstance();
        await orchestrator.initialize();
        setCommandOrchestrator(orchestrator);
        addAssistantMessage('✅ API密钥配置成功，正在处理您的请求...');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        addAssistantMessage(`❌ 初始化失败: ${errorMessage}`);
        return { success: false, error: `初始化失败: ${errorMessage}` };
      }
    }

    try {
      const result = input.startsWith('/')
        ? await commandOrchestrator!.executeSlashCommand(input.slice(1).split(' ')[0], input.slice(1).split(' ').slice(1))
        : await commandOrchestrator!.executeNaturalLanguage(input);
      
      if (result.success && result.output) {
        addAssistantMessage(result.output);
      } else if (result.error) {
        addAssistantMessage(`❌ ${result.error}`);
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const result = { success: false, error: `执行失败: ${errorMessage}` };
      addAssistantMessage(`❌ ${result.error}`);
      return result;
    }
  });

  const handleClear = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleExit = useMemoizedFn(async () => {
    try {
      if (commandOrchestrator) {
        await commandOrchestrator.cleanup();
      }
      resetSession();
    } catch (error) {
      console.error('清理资源时出错:', error);
    }
  });

  useEffect(() => {
    if (!isInitialized) {
      initializeApp();
    }
    return () => {
      handleExit();
    };
  }, [isInitialized]); // 只依赖isInitialized，因为initializeApp和handleExit已经被useMemoizedFn缓存

  if (!isInitialized) {
    return (
      <Box padding={1}>
        <Box marginRight={1}><Text>⚡</Text></Box>
        <Text>正在启动 Blade AI 助手...</Text>
      </Box>
    );
  }

  return (
    <EnhancedReplInterface 
      onCommandSubmit={handleCommandSubmit}
      onClear={handleClear}
      onExit={() => exit()}
    />
  );
};

export const BladeApp: React.FC<BladeAppProps> = (props) => (
  <ErrorBoundary>
    <SessionProvider>
      <BladeAppInner {...props} />
    </SessionProvider>
  </ErrorBoundary>
);

export async function main() {
  const program = new Command();

  program
    .version('1.3.0', '-v, --version', '显示当前版本')
    .description('Blade AI - 智能AI助手命令行界面')
    .option('-d, --debug', '启用调试模式');

  // 注册所有命令
  agentLlmCommand(program);
  configCommand(program);
  llmCommand(program);
  mcpCommand(program);
  toolsCommand(program);

  // 设置默认动作：如果没有提供子命令，则启动交互式UI
  program.action((options) => {
    render(React.createElement(BladeApp, { debug: options.debug }));
  });

  await program.parseAsync(process.argv);

  // 如果解析后没有匹配到任何已知命令（除了默认的 help, version），则也启动交互式UI
  // commander 在没有匹配到命令时，args 数组会是空的
  if (program.args.length === 0) {
     render(React.createElement(BladeApp, { debug: program.opts().debug }));
  }
}
