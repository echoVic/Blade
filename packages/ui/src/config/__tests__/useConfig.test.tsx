/**
 * useConfig Hook 测试
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useConfig } from '../hooks/useConfig.js';
import { ConfigProvider } from '../contexts/ConfigContext.js';

// 模拟 ConfigurationManager
const mockConfigManager = {
  initialize: jest.fn(),
  getConfig: jest.fn(),
  getState: jest.fn(),
  updateConfig: jest.fn(),
  reload: jest.fn(),
  subscribe: jest.fn(),
  destroy: jest.fn(),
};

// 模拟 @blade-ai/core 包
jest.mock('@blade-ai/core', () => ({
  ConfigurationManager: jest.fn().mockImplementation(() => mockConfigManager),
}));

describe('useConfig Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 设置默认的模拟返回值
    mockConfigManager.initialize.mockResolvedValue({
      auth: { apiKey: 'test-key' },
      ui: { theme: 'dark' },
    });
    
    mockConfigManager.getConfig.mockReturnValue({
      auth: { apiKey: 'test-key' },
      ui: { theme: 'dark' },
    });
    
    mockConfigManager.getState.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      lastReload: new Date().toISOString(),
      configVersion: '1.0.0',
      loadedLayers: [],
      configHash: 'test-hash',
    });
    
    mockConfigManager.subscribe.mockImplementation((callback) => {
      // 模拟订阅
      return () => {}; // 取消订阅函数
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConfigProvider>{children}</ConfigProvider>
  );

  describe('初始化', () => {
    test('应该提供默认的配置状态', () => {
      const { result } = renderHook(() => useConfig(), { wrapper });
      
      expect(result.current.config).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    test('应该自动加载配置', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      // 等待异步操作完成
      await waitForNextUpdate();
      
      expect(result.current.config).toEqual({
        auth: { apiKey: 'test-key' },
        ui: { theme: 'dark' },
      });
      expect(result.current.isLoading).toBe(false);
    });

    test('应该处理加载错误', async () => {
      mockConfigManager.initialize.mockRejectedValue(new Error('加载失败'));
      
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      try {
        await waitForNextUpdate();
      } catch (error) {
        // 预期的错误
      }
      
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('加载失败');
    });
  });

  describe('配置操作', () => {
    test('应该能够更新配置', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const updates = { ui: { theme: 'light' } };
      mockConfigManager.updateConfig.mockResolvedValue(undefined);
      mockConfigManager.getConfig.mockReturnValue({
        auth: { apiKey: 'test-key' },
        ui: { theme: 'light' },
      });
      
      await act(async () => {
        await result.current.updateConfig(updates);
      });
      
      expect(result.current.config?.ui.theme).toBe('light');
    });

    test('应该处理更新错误', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      mockConfigManager.updateConfig.mockRejectedValue(new Error('更新失败'));
      
      await act(async () => {
        try {
          await result.current.updateConfig({ ui: { theme: 'light' } });
        } catch (error) {
          // 预期的错误
        }
      });
      
      expect(result.current.error).toBeDefined();
    });

    test('应该能够重新加载配置', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const newConfig = {
        auth: { apiKey: 'new-key' },
        ui: { theme: 'light' },
      };
      
      mockConfigManager.reload.mockResolvedValue(newConfig);
      mockConfigManager.getConfig.mockReturnValue(newConfig);
      
      await act(async () => {
        await result.current.reloadConfig();
      });
      
      expect(result.current.config?.auth.apiKey).toBe('new-key');
    });

    test('应该能够获取配置值', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const apiKey = result.current.getConfigValue('auth.apiKey');
      expect(apiKey).toBe('test-key');
      
      const nonExistent = result.current.getConfigValue('non.existent');
      expect(nonExistent).toBeUndefined();
    });

    test('应该能够设置配置值', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      mockConfigManager.updateConfig.mockResolvedValue(undefined);
      mockConfigManager.getConfig.mockReturnValue({
        auth: { apiKey: 'new-key' },
        ui: { theme: 'dark' },
      });
      
      await act(async () => {
        await result.current.setConfigValue('auth.apiKey', 'new-key');
      });
      
      expect(result.current.config?.auth.apiKey).toBe('new-key');
    });
  });

  describe('订阅功能', () => {
    test('应该能够订阅配置事件', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const mockCallback = jest.fn();
      const unsubscribe = result.current.subscribe(mockCallback);
      
      expect(typeof unsubscribe).toBe('function');
      
      // 验证订阅逻辑通过配置管理器处理
      expect(mockConfigManager.subscribe).toHaveBeenCalled();
    });
  });

  describe('工具方法', () => {
    test('应该能够导出配置', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const exported = result.current.exportConfig();
      expect(typeof exported).toBe('string');
      expect(exported).toContain('test-key');
    });

    test('应该处理导出错误', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      // 模拟获取配置失败
      mockConfigManager.getConfig.mockReturnValue(null);
      
      const exported = result.current.exportConfig();
      expect(exported).toBe('');
    });

    test('应该能够导入配置', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const configData = JSON.stringify({
        auth: { apiKey: 'imported-key' },
        ui: { theme: 'light' },
      });
      
      mockConfigManager.updateConfig.mockResolvedValue(undefined);
      mockConfigManager.getConfig.mockReturnValue({
        auth: { apiKey: 'imported-key' },
        ui: { theme: 'light' },
      });
      
      await act(async () => {
        await result.current.importConfig(configData);
      });
      
      expect(result.current.config?.auth.apiKey).toBe('imported-key');
    });

    test('应该处理导入错误', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useConfig(), { wrapper });
      
      await waitForNextUpdate();
      
      const invalidData = 'invalid json';
      
      await act(async () => {
        try {
          await result.current.importConfig(invalidData);
        } catch (error) {
          // 预期的错误
        }
      });
      
      expect(result.current.error).toBeDefined();
    });
  });

  describe('选项配置', () => {
    test('应该支持禁用自动加载', async () => {
      const { result } = renderHook(() => useConfig({ autoLoad: false }), { wrapper });
      
      // 不应该自动加载
      expect(result.current.isLoading).toBe(false);
      expect(mockConfigManager.initialize).not.toHaveBeenCalled();
    });

    test('应该支持自定义错误处理', async () => {
      const mockErrorHandler = jest.fn();
      mockConfigManager.initialize.mockRejectedValue(new Error('加载失败'));
      
      const { result } = renderHook(() => useConfig({ 
        errorHandler: mockErrorHandler 
      }), { wrapper });
      
      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockErrorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});