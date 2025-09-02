import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp, Spacer } from 'ink';
import { useSession } from '../contexts/SessionContext.js';
import { CommandResult } from '../services/CommandOrchestrator.js';

interface EnhancedReplInterfaceProps {
  onCommandSubmit: (command: string) => Promise<CommandResult>;
  onClear: () => void;
  onExit: () => void;
}

export const EnhancedReplInterface: React.FC<EnhancedReplInterfaceProps> = ({
  onCommandSubmit,
  onClear,
  onExit,
}) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { state: sessionState, dispatch } = useSession();
  const { exit } = useApp();

  const handleSubmit = useCallback(async () => {
    if (input.trim() && !isProcessing) {
      const command = input.trim();
      
      // 添加到历史记录
      setCommandHistory(prev => [...prev, command]);
      setHistoryIndex(-1);
      
      setIsProcessing(true);
      dispatch({ type: 'SET_THINKING', payload: true });
      
      try {
        const result = await onCommandSubmit(command);
        
        if (!result.success && result.error) {
          dispatch({ type: 'SET_ERROR', payload: result.error });
        }
        
        setInput('');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        dispatch({ type: 'SET_ERROR', payload: `执行失败: ${errorMessage}` });
      } finally {
        setIsProcessing(false);
        dispatch({ type: 'SET_THINKING', payload: false });
      }
    }
  }, [input, isProcessing, onCommandSubmit, dispatch]);

  const handleClear = useCallback(() => {
    onClear();
    dispatch({ type: 'CLEAR_MESSAGES' });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [onClear, dispatch]);

  const handleExit = useCallback(() => {
    onExit();
    exit();
  }, [onExit, exit]);

  // 处理用户输入
  useInput((inputKey, key) => {
    if (key.return) {
      // 回车键提交命令
      handleSubmit();
    } else if (key.ctrl && key.name === 'c') {
      // Ctrl+C 退出
      handleExit();
    } else if (key.ctrl && key.name === 'l') {
      // Ctrl+L 清屏
      handleClear();
    } else if (key.upArrow && commandHistory.length > 0) {
      // 上箭头 - 命令历史
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex] || '');
    } else if (key.downArrow) {
      // 下箭头 - 命令历史
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex] || '');
        }
      }
    } else if (key.backspace || key.delete) {
      // 退格键删除字符
      setInput(prev => prev.slice(0, -1));
    } else if (inputKey && key.name !== 'escape') {
      // 普通字符输入
      setInput(prev => prev + inputKey);
    }
  });

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* 标题栏 */}
      <Box flexDirection="row" justifyContent="space-between" paddingX={1} paddingY={0}>
        <Text color="blue">🤖 Blade AI 助手</Text>
        <Text color="gray">Ctrl+C 退出 | Ctrl+L 清屏</Text>
      </Box>

      {/* 分隔线 */}
      <Box height={1} width="100%">
        <Text color="gray">─</Text>
        <Spacer />
        <Text color="gray">─</Text>
      </Box>

      {/* 消息显示区域 - 可滚动 */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={0}>
        {sessionState.messages.length === 0 && !sessionState.error && (
          <Box flexDirection="column" paddingY={1}>
            <Text color="blue">🚀 欢迎使用 Blade AI 助手!</Text>
            <Text> </Text>
            <Text color="gray">输入 /help 查看可用命令</Text>
            <Text color="gray">直接输入问题开始对话</Text>
          </Box>
        )}

        {sessionState.messages.map((message) => (
          <Box key={message.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color={message.role === 'user' ? 'green' : 'blue'}>
                {message.role === 'user' ? '👤 你: ' : '🤖 助手: '}
              </Text>
            </Box>
            <Box marginLeft={3}>
              <Text>{message.content}</Text>
            </Box>
          </Box>
        ))}
        
        {isProcessing && (
          <Box flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="yellow">⏳ 助手正在思考...</Text>
            </Box>
          </Box>
        )}
        
        {sessionState.error && (
          <Box flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="red">❌ 错误: </Text>
            </Box>
            <Box marginLeft={3}>
              <Text color="red">{sessionState.error}</Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* 输入区域 */}
      <Box flexDirection="row" alignItems="center" paddingX={1} paddingY={1}>
        <Text color="green">{'>>> '}</Text>
        <Text>{input}</Text>
        {isProcessing && <Text color="yellow">|</Text>}
      </Box>

      {/* 状态栏 */}
      <Box flexDirection="row" justifyContent="space-between" paddingX={1} paddingY={0}>
        <Text color="gray">
          {sessionState.messages.length > 0 ? `${sessionState.messages.length} 条消息` : '暂无消息'}
        </Text>
        <Text color="gray">
          {isProcessing ? '处理中...' : '就绪'}
        </Text>
      </Box>
    </Box>
  );
};