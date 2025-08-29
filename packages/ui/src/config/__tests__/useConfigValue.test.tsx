/**
 * useConfigValue Hook 测试
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useConfigValue, useConfigValues, useConfigValidation } from '../hooks/useConfigValue.js';
import { ConfigProvider } from '../contexts/ConfigContext.js';

// 模拟 useConfig hook
const mockUseConfig = jest.fn();

// 模拟 @blade-ai/core 包
jest.mock('../hooks/useConfig.js', () => ({
  useConfig: () => mockUseConfig(),
}));

describe('useConfigValue Hook', () => {
  const mockConfig = {
    auth: {
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      settings: {
        timeout: 30000,
        retries: 3,
      },
    },
    ui: {
      theme: 'dark',
      language: 'zh-CN',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 设置默认的模拟返回值
    mockUseConfig.mockReturnValue({
      config: mockConfig,
      getConfigValue: (path: string) => {
        return path.split('.').reduce((obj: any, key: string) => {
          return obj && obj[key] !== undefined ? obj[key] : undefined;
        }, mockConfig);
      },
      setConfigValue: jest.fn(),
      isLoading: false,
      error: null,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConfigProvider>{children}</ConfigProvider>
  );

  describe('useConfigValue', () => {
    test('应该返回正确的配置值', () => {
      const { result } = renderHook(() => useConfigValue('auth.apiKey'), { wrapper });
      
      expect(result.current.value).toBe('test-key');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('应该处理嵌套配置值', () => {
      const { result } = renderHook(() => useConfigValue('auth.settings.timeout'), { wrapper });
      
      expect(result.current.value).toBe(30000);
    });

    test('应该使用默认值处理未定义的配置', () => {
      const { result } = renderHook(() => useConfigValue('non.existent', { 
        defaultValue: 'default-value' 
      }), { wrapper });
      
      expect(result.current.value).toBe('default-value');
    });

    test('应该应用值转换函数', () => {
      const transform = (value: string) => value.toUpperCase();
      const { result } = renderHook(() => useConfigValue('auth.apiKey', { 
        transform 
      }), { wrapper });
      
      expect(result.current.value).toBe('TEST-KEY');
    });

    test('应该处理转换错误', () => {
      const transform = () => { throw new Error('转换失败'); };
      const { result } = renderHook(() => useConfigValue('auth.apiKey', { 
        transform 
      }), { wrapper });
      
      // 应该返回原始值而不是抛出错误
      expect(result.current.value).toBe('test-key');
    });

    test('应该支持设置配置值', async () => {
      const mockSetConfigValue = jest.fn();
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme'), { wrapper });
      
      await act(async () => {
        await result.current.setValue('light');
      });
      
      expect(mockSetConfigValue).toHaveBeenCalledWith('ui.theme', 'light');
    });

    test('应该处理设置值错误', async () => {
      const mockSetConfigValue = jest.fn().mockRejectedValue(new Error('设置失败'));
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme'), { wrapper });
      
      await act(async () => {
        try {
          await result.current.setValue('light');
        } catch (error) {
          // 预期的错误
        }
      });
      
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('设置失败');
    });

    test('应该支持通过更新函数修改值', async () => {
      const mockSetConfigValue = jest.fn();
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const { result } = renderHook(() => useConfigValue('auth.settings.timeout'), { wrapper });
      
      await act(async () => {
        await result.current.update((current: number) => current + 10000);
      });
      
      expect(mockSetConfigValue).toHaveBeenCalledWith('auth.settings.timeout', 40000);
    });

    test('应该支持重置为默认值', async () => {
      const mockSetConfigValue = jest.fn();
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme', { 
        defaultValue: 'light' 
      }), { wrapper });
      
      await act(async () => {
        await result.current.reset();
      });
      
      expect(mockSetConfigValue).toHaveBeenCalledWith('ui.theme', 'light');
    });

    test('应该支持防抖更新', async () => {
      jest.useFakeTimers();
      
      const mockSetConfigValue = jest.fn();
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme', { 
        debounceMs: 300 
      }), { wrapper });
      
      await act(async () => {
        result.current.setValue('light');
        jest.advanceTimersByTime(150);
        result.current.setValue('dark');
        jest.advanceTimersByTime(300);
      });
      
      // 只应该调用一次（最后一次更新）
      expect(mockSetConfigValue).toHaveBeenCalledTimes(1);
      expect(mockSetConfigValue).toHaveBeenCalledWith('ui.theme', 'dark');
      
      jest.useRealTimers();
    });

    test('应该启用热重载选项', () => {
      // 热重载是通过配置管理器处理的，这里验证选项被正确传递
      const { result } = renderHook(() => useConfigValue('ui.theme', { 
        enableHotReload: false 
      }), { wrapper });
      
      expect(result.current).toBeDefined();
    });
  });

  describe('useConfigValues', () => {
    test('应该返回多个配置值', () => {
      const paths = {
        apiKey: 'auth.apiKey',
        theme: 'ui.theme',
        timeout: 'auth.settings.timeout',
      };
      
      const { result } = renderHook(() => useConfigValues(paths), { wrapper });
      
      expect(result.current.values).toEqual({
        apiKey: 'test-key',
        theme: 'dark',
        timeout: 30000,
      });
    });

    test('应该支持批量更新配置值', async () => {
      const mockSetConfigValue = jest.fn();
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const paths = {
        theme: 'ui.theme',
        language: 'ui.language',
      };
      
      const { result } = renderHook(() => useConfigValues(paths), { wrapper });
      
      await act(async () => {
        await result.current.setValues({
          theme: 'light',
          language: 'en-US',
        });
      });
      
      expect(mockSetConfigValue).toHaveBeenCalledWith('ui.theme', 'light');
      expect(mockSetConfigValue).toHaveBeenCalledWith('ui.language', 'en-US');
    });

    test('应该支持重置指定的配置值', async () => {
      const mockSetConfigValue = jest.fn();
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const paths = {
        theme: 'ui.theme',
        language: 'ui.language',
      };
      
      const { result } = renderHook(() => useConfigValues(paths), { wrapper });
      
      await act(async () => {
        await result.current.reset(['theme']);
      });
      
      expect(mockSetConfigValue).toHaveBeenCalledWith('ui.theme', undefined);
      expect(mockSetConfigValue).toHaveBeenCalledTimes(1);
    });

    test('应该处理批量更新错误', async () => {
      const mockSetConfigValue = jest.fn().mockRejectedValue(new Error('批量更新失败'));
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const paths = {
        theme: 'ui.theme',
      };
      
      const { result } = renderHook(() => useConfigValues(paths), { wrapper });
      
      await act(async () => {
        try {
          await result.current.setValues({ theme: 'light' });
        } catch (error) {
          // 预期的错误
        }
      });
      
      expect(result.current.error).toBeDefined();
    });
  });

  describe('useConfigValidation', () => {
    test('应该验证配置值', () => {
      const validator = (value: string) => ({
        valid: value.length > 5,
        errors: value.length <= 5 ? ['API密钥太短'] : [],
      });
      
      const { result } = renderHook(() => useConfigValidation('auth.apiKey', validator), { wrapper });
      
      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toHaveLength(0);
    });

    test('应该检测无效的配置值', () => {
      const validator = (value: string) => ({
        valid: value.length > 20,
        errors: value.length <= 20 ? ['API密钥太短'] : [],
      });
      
      const { result } = renderHook(() => useConfigValidation('auth.apiKey', validator), { wrapper });
      
      expect(result.current.isValid).toBe(false);
      expect(result.current.errors).toContain('API密钥太短');
    });

    test('应该返回配置值', () => {
      const validator = () => ({ valid: true, errors: [] });
      const { result } = renderHook(() => useConfigValidation('auth.apiKey', validator), { wrapper });
      
      expect(result.current.value).toBe('test-key');
    });
  });

  describe('加载状态', () => {
    test('应该正确处理加载状态', () => {
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        isLoading: true,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme'), { wrapper });
      
      expect(result.current.isLoading).toBe(true);
    });

    test('应该正确处理更新状态', async () => {
      const mockSetConfigValue = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        setConfigValue: mockSetConfigValue,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme'), { wrapper });
      
      expect(result.current.isLoading).toBe(false);
      
      let promise: Promise<void>;
      act(() => {
        promise = result.current.setValue('light');
      });
      
      expect(result.current.isLoading).toBe(true);
      
      await act(async () => {
        await promise;
      });
      
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('错误处理', () => {
    test('应该传递来自useConfig的错误', () => {
      const error = new Error('配置错误');
      mockUseConfig.mockReturnValue({
        ...mockUseConfig(),
        error,
      });
      
      const { result } = renderHook(() => useConfigValue('ui.theme'), { wrapper });
      
      expect(result.current.error).toBe(error);
    });
  });
});