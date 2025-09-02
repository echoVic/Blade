import React, { useState, useCallback, useEffect } from 'react';
import { Box, useApp } from 'ink';
import { SessionProvider, useSession } from './contexts/SessionContext.js';
import { EnhancedReplInterface } from './components/EnhancedReplInterface.js';
import { CommandOrchestrator, CommandResult } from './services/CommandOrchestrator.js';
import { ConfigService } from './config/ConfigService.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

interface ReplAppProps {
  config?: any;
  debug?: boolean;
}

const ReplAppInner: React.FC<ReplAppProps> = ({ config, debug = false }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [commandOrchestrator, setCommandOrchestrator] = useState<CommandOrchestrator | null>(null);
  const [configService] = useState(() => ConfigService.getInstance());
  const { state: sessionState, addUserMessage, addAssistantMessage, clearMessages, resetSession } = useSession();
  const { exit } = useApp();

  // 初始化应用
  const initializeApp = useCallback(async () => {
    try {
      console.log('正在初始化 Blade AI 助手...');
      
      // 初始化配置服务
      await configService.initialize();
      
      // 初始化命令编排器
      const orchestrator = CommandOrchestrator.getInstance();
      await orchestrator.initialize();
      setCommandOrchestrator(orchestrator);
      
      setIsInitialized(true);
      
      // 显示欢迎消息
      addAssistantMessage('🚀 Blade AI 助手已启动！');
      addAssistantMessage('输入 /help 查看可用命令，或直接输入问题开始对话');
      
    } catch (error) {
      console.error('应用初始化失败:', error);
      addAssistantMessage(`❌ 初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [configService, addAssistantMessage]);

  // 处理命令提交
  const handleCommandSubmit = useCallback(async (input: string): Promise<CommandResult> => {
    if (!commandOrchestrator) {
      return { success: false, error: '命令编排器未初始化' };
    }
    
    // 添加用户消息到会话
    addUserMessage(input);
    
    try {
      let result: CommandResult;
      
      // 处理命令
      if (input.startsWith('/')) {
        // 处理斜杠命令
        const commandParts = input.slice(1).split(' ');
        const command = commandParts[0];
        const args = commandParts.slice(1);
        result = await commandOrchestrator.executeSlashCommand(command, args);
      } else {
        // 处理自然语言命令
        result = await commandOrchestrator.executeNaturalLanguage(input);
      }
      
      // 显示结果
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

  // 清除会话
  const handleClear = useCallback(() => {
    clearMessages();
    if (commandOrchestrator) {
      // 可以在这里添加额外的清除逻辑
    }
  }, [clearMessages, commandOrchestrator]);

  // 退出应用
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

  // 初始化应用
  useEffect(() => {
    if (!isInitialized) {
      initializeApp();
    }
    
    return () => {
      // 组件卸载时清理
      handleExit();
    };
  }, [isInitialized, initializeApp, handleExit]);

  if (!isInitialized) {
    return (
      <Box padding={1}>
        <Box marginRight={1}>
          <Text>⚡</Text>
        </Box>
        <Text>正在启动 Blade AI 助手...</Text>
      </Box>
    );
  }

  return (
    <EnhancedReplInterface 
      onCommandSubmit={handleCommandSubmit}
      onClear={handleClear}
      onExit={handleExit}
    />
  );
};

export const ReplApp: React.FC<ReplAppProps> = (props) => {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <ReplAppInner {...props} />
      </SessionProvider>
    </ErrorBoundary>
  );
};