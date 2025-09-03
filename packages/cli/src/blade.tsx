
import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
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

  const initializeApp = useCallback(async () => {
    try {
      await configService.initialize();
      const orchestrator = CommandOrchestrator.getInstance();
      await orchestrator.initialize();
      setCommandOrchestrator(orchestrator);
      setIsInitialized(true);
      addAssistantMessage('🚀 Blade AI 助手已启动！输入 /help 查看可用命令，或直接提问。');
    } catch (error) {
      addAssistantMessage(`❌ 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [configService, addAssistantMessage]);

  const handleCommandSubmit = useCallback(async (input: string): Promise<CommandResult> => {
    if (!commandOrchestrator) {
      return { success: false, error: '命令编排器未初始化' };
    }
    addUserMessage(input);
    try {
      const result = input.startsWith('/')
        ? await commandOrchestrator.executeSlashCommand(input.slice(1).split(' ')[0], input.slice(1).split(' ').slice(1))
        : await commandOrchestrator.executeNaturalLanguage(input);
      
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
  }, [commandOrchestrator, addUserMessage, addAssistantMessage]);

  const handleClear = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleExit = useCallback(async () => {
    try {
      if (commandOrchestrator) {
        await commandOrchestrator.cleanup();
      }
      resetSession();
    } catch (error) {
      console.error('清理资源时出错:', error);
    }
  }, [commandOrchestrator, resetSession]);

  useEffect(() => {
    if (!isInitialized) {
      initializeApp();
    }
    return () => {
      handleExit();
    };
  }, [isInitialized, initializeApp, handleExit]);

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
  if (program.args.length === 0 && !program.matchedCommand) {
     render(React.createElement(BladeApp, { debug: program.opts().debug }));
  }
}
