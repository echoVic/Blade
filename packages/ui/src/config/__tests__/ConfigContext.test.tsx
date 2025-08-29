/**
 * ConfigContext 测试
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { 
  ConfigProvider, 
  useConfigContext,
  ConfigContext,
  withConfig
} from '../contexts/ConfigContext.js';

// 模拟 ConfigurationManager
const mockConfigManager = {
  initialize: jest.fn(),
  getConfig: jest.fn(),
  getState: jest.fn(),
  updateConfig: jest.fn(),
  reload: jest.fn(),
  subscribe: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  destroy: jest.fn(),
};

// 模拟 @blade-ai/core 包
jest.mock('@blade-ai/core', () => ({
  ConfigurationManager: jest.fn().mockImplementation(() => mockConfigManager),
}));

// 测试组件
const TestComponent = () => {
  const { config, isInitialized, error, initialize } = useConfigContext();
  
  if (error) {
    return <div>Error: {error.message}</div>;
  }
  
  if (!isInitialized) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      <span>Config: {config ? 'Loaded' : 'Not loaded'}</span>
      <button onClick={initialize}>Initialize</button>
    </div>
  );
};

// 带配置的测试组件
const ComponentWithConfig = withConfig(({ config, isInitialized }: any) => {
  return (
    <div>
      Config Status: {isInitialized ? 'Initialized' : 'Not initialized'}
      {config && <span>API Key: {config.auth?.apiKey}</span>}
    </div>
  );
});

describe('ConfigContext', () => {
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
    
    mockConfigManager.subscribe.mockImplementation(() => {
      return () => {}; // 取消订阅函数
    });
    
    mockConfigManager.on.mockImplementation(() => {});
    mockConfigManager.off.mockImplementation(() => {});
  });

  describe('ConfigProvider', () => {
    test('应该正确渲染子组件', () => {
      const { getByText } = render(
        <ConfigProvider>
          <div>Test Child</div>
        </ConfigProvider>
      );
      
      expect(getByText('Test Child')).toBeInTheDocument();
    });

    test('应该自动初始化配置管理器', async () => {
      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 验证初始化被调用
      expect(mockConfigManager.initialize).toHaveBeenCalled();
    });

    test('应该支持禁用自动初始化', async () => {
      render(
        <ConfigProvider autoInitialize={false}>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 验证初始化没有被调用
      expect(mockConfigManager.initialize).not.toHaveBeenCalled();
    });

    test('应该处理初始化错误', async () => {
      mockConfigManager.initialize.mockRejectedValue(new Error('初始化失败'));
      
      const { getByText } = render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(getByText('Error: 初始化失败')).toBeInTheDocument();
    });

    test('应该支持自定义错误处理', async () => {
      const mockOnError = jest.fn();
      mockConfigManager.initialize.mockRejectedValue(new Error('初始化失败'));
      
      render(
        <ConfigProvider onError={mockOnError}>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 等待异步操作完成
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('应该提供配置管理器实例', () => {
      let capturedManager: any;
      
      const CaptureManagerComponent = () => {
        const { manager } = useConfigContext();
        capturedManager = manager;
        return null;
      };
      
      render(
        <ConfigProvider>
          <CaptureManagerComponent />
        </ConfigProvider>
      );
      
      expect(capturedManager).toBeDefined();
      expect(capturedManager.initialize).toBeDefined();
    });
  });

  describe('useConfigContext', () => {
    test('应该提供配置上下文值', async () => {
      const TestConsumer = () => {
        const { config, state, isInitialized, error } = useConfigContext();
        
        return (
          <div>
            <span>Initialized: {isInitialized.toString()}</span>
            <span>Has Config: {Boolean(config).toString()}</span>
            <span>Has Error: {Boolean(error).toString()}</span>
            <span>State Valid: {state.isValid.toString()}</span>
          </div>
        );
      };
      
      const { getByText } = render(
        <ConfigProvider>
          <TestConsumer />
        </ConfigProvider>
      );
      
      // 验证上下文值
      expect(getByText('Initialized: true')).toBeInTheDocument();
      expect(getByText('Has Config: true')).toBeInTheDocument();
      expect(getByText('Has Error: false')).toBeInTheDocument();
      expect(getByText('State Valid: true')).toBeInTheDocument();
    });

    test('应该在没有Provider的情况下抛出错误', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useConfigContext must be used within a ConfigProvider');
      
      consoleError.mockRestore();
    });
  });

  describe('withConfig HOC', () => {
    test('应该正确注入配置上下文', async () => {
      const { getByText } = render(
        <ConfigProvider>
          <ComponentWithConfig />
        </ConfigProvider>
      );
      
      // 验证 HOC 正确注入了配置
      expect(getByText('Config Status: Initialized')).toBeInTheDocument();
    });

    test('应该正确设置 displayName', () => {
      expect(ComponentWithConfig.displayName).toBe('WithConfig(TestComponent)');
    });
  });

  describe('配置操作方法', () => {
    test('应该提供初始化方法', async () => {
      const TestInitComponent = () => {
        const { initialize, isInitialized } = useConfigContext();
        
        return (
          <div>
            <span>Initialized: {isInitialized.toString()}</span>
            <button onClick={() => initialize()}>Init</button>
          </div>
        );
      };
      
      const { getByText, getByRole } = render(
        <ConfigProvider autoInitialize={false}>
          <TestInitComponent />
        </ConfigProvider>
      );
      
      expect(getByText('Initialized: false')).toBeInTheDocument();
      
      // 手动调用初始化
      const initButton = getByRole('button');
      await act(async () => {
        initButton.click();
      });
      
      expect(mockConfigManager.initialize).toHaveBeenCalled();
    });

    test('应该提供配置更新方法', async () => {
      let capturedUpdateConfig: any;
      
      const TestUpdateComponent = () => {
        const { updateConfig } = useConfigContext();
        capturedUpdateConfig = updateConfig;
        return null;
      };
      
      render(
        <ConfigProvider>
          <TestUpdateComponent />
        </ConfigProvider>
      );
      
      expect(typeof capturedUpdateConfig).toBe('function');
      
      // 调用更新方法
      const updates = { ui: { theme: 'light' } };
      await act(async () => {
        await capturedUpdateConfig(updates);
      });
      
      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith(updates);
    });

    test('应该提供配置重载方法', async () => {
      let capturedReloadConfig: any;
      
      const TestReloadComponent = () => {
        const { reloadConfig } = useConfigContext();
        capturedReloadConfig = reloadConfig;
        return null;
      };
      
      render(
        <ConfigProvider>
          <TestReloadComponent />
        </ConfigProvider>
      );
      
      expect(typeof capturedReloadConfig).toBe('function');
      
      // 调用重载方法
      await act(async () => {
        await capturedReloadConfig();
      });
      
      expect(mockConfigManager.reload).toHaveBeenCalled();
    });
  });

  describe('事件监听', () => {
    test('应该订阅配置变更事件', async () => {
      render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 验证事件监听器被设置
      expect(mockConfigManager.on).toHaveBeenCalledWith('configLoaded', expect.any(Function));
      expect(mockConfigManager.on).toHaveBeenCalledWith('configChanged', expect.any(Function));
    });

    test('应该在组件卸载时清理事件监听器', async () => {
      const { unmount } = render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 卸载组件
      unmount();
      
      // 验证事件监听器被移除
      expect(mockConfigManager.off).toHaveBeenCalledWith('configLoaded', expect.any(Function));
      expect(mockConfigManager.off).toHaveBeenCalledWith('configChanged', expect.any(Function));
    });
  });

  describe('资源清理', () => {
    test('应该在组件卸载时销毁配置管理器', async () => {
      const { unmount } = render(
        <ConfigProvider>
          <TestComponent />
        </ConfigProvider>
      );
      
      // 卸载组件
      unmount();
      
      // 验证配置管理器被销毁
      expect(mockConfigManager.destroy).toHaveBeenCalled();
    });
  });
});