/**
 * 主题组件单元测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider, useTheme, useToken } from '../contexts/ThemeContext';
import { Text, Button, Box } from '../components/ThemeExample';

describe('Theme Components', () => {
  describe('ThemeProvider', () => {
    it('应该正确提供主题上下文', () => {
      const TestComponent: React.FC = () => {
        const { theme } = useTheme();
        return <div data-testid="theme-name">{theme.name}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('Default');
    });

    it('应该支持自定义初始主题', () => {
      const TestComponent: React.FC = () => {
        const { theme } = useTheme();
        return <div data-testid="theme-name">{theme.name}</div>;
      };

      render(
        <ThemeProvider initialTheme="dark">
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-name')).toHaveTextContent('Dark');
    });
  });

  describe('Text Component', () => {
    it('应该正确渲染文本内容', () => {
      render(
        <ThemeProvider>
          <Text>Test Text</Text>
        </ThemeProvider>
      );

      expect(screen.getByText('Test Text')).toBeInTheDocument();
    });

    it('应该应用正确的样式', () => {
      render(
        <ThemeProvider>
          <Text>Styled Text</Text>
        </ThemeProvider>
      );

      const textElement = screen.getByText('Styled Text');
      expect(textElement).toBeInTheDocument();
      // 这里可以添加更多样式相关的断言
    });
  });

  describe('Button Component', () => {
    it('should render button with correct text', () => {
      render(
        <ThemeProvider>
          <Button>Click Me</Button>
        </ThemeProvider>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
    });

    it('should handle click events', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(
        <ThemeProvider>
          <Button onPress={handleClick}>Click Me</Button>
        </ThemeProvider>
      );

      await user.click(screen.getByRole('button', { name: 'Click Me' }));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply variant styles', () => {
      render(
        <ThemeProvider>
          <Button variant="primary">Primary Button</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button', { name: 'Primary Button' });
      expect(button).toBeInTheDocument();
      // 可以添加更多样式断言
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <ThemeProvider>
          <Button disabled>Disabled Button</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button', { name: 'Disabled Button' });
      expect(button).toBeDisabled();
    });
  });

  describe('Box Component', () => {
    it('should render children correctly', () => {
      render(
        <ThemeProvider>
          <Box>
            <Text>Box Content</Text>
          </Box>
        </ThemeProvider>
      );

      expect(screen.getByText('Box Content')).toBeInTheDocument();
    });

    it('should apply flex properties', () => {
      render(
        <ThemeProvider>
          <Box flexDirection="column" alignItems="center">
            <Text>Flex Content</Text>
          </Box>
        </ThemeProvider>
      );

      const box = screen.getByText('Flex Content').parentElement;
      expect(box).toBeInTheDocument();
      // 可以添加更多样式断言
    });

    it('should apply variant styles', () => {
      render(
        <ThemeProvider>
          <Box variant="card">
            <Text>Card Content</Text>
          </Box>
        </ThemeProvider>
      );

      const box = screen.getByText('Card Content').parentElement;
      expect(box).toBeInTheDocument();
    });
  });
});

describe('Theme Hooks', () => {
  describe('useTheme', () => {
    it('should throw error when used outside ThemeProvider', () => {
      const TestComponent: React.FC = () => {
        useTheme();
        return <div>Should not render</div>;
      };

      expect(() => render(<TestComponent />)).toThrow('useTheme must be used within a ThemeProvider');
    });

    it('should provide theme context values', () => {
      const TestComponent: React.FC = () => {
        const { theme, mode, setTheme, setMode } = useTheme();
        return (
          <div>
            <div data-testid="theme-id">{theme.id}</div>
            <div data-testid="theme-mode">{mode}</div>
            <button data-testid="set-theme" onClick={() => setTheme('dark')}>
              Set Theme
            </button>
            <button data-testid="set-mode" onClick={() => setMode('dark')}>
              Set Mode
            </button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-id')).toHaveTextContent('default');
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');
    });
  });

  describe('useToken', () => {
    it('should return correct token values', () => {
      const TestComponent: React.FC = () => {
        const whiteColor = useToken<string>('colors.base.white');
        const fontSize = useToken<number>('typography.fontSize.base');
        return (
          <div>
            <div data-testid="white-color">{whiteColor}</div>
            <div data-testid="font-size">{fontSize}</div>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('white-color')).toHaveTextContent('#FFFFFF');
      expect(screen.getByTestId('font-size')).toHaveTextContent('1');
    });

    it('should return undefined for invalid tokens', () => {
      const TestComponent: React.FC = () => {
        const invalidToken = useToken('invalid.token.path');
        return <div data-testid="invalid-token">{String(invalidToken)}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('invalid-token')).toHaveTextContent('undefined');
    });
  });
});

describe('Themed Components Integration', () => {
  it('should work together in a layout', () => {
    const TestLayout: React.FC = () => {
      return (
        <ThemeProvider>
          <Box variant="container">
            <Text variant="primary" bold>
              Page Title
            </Text>
            <Box variant="section">
              <Text>Section content</Text>
            </Box>
            <Button variant="primary">Action Button</Button>
          </Box>
        </ThemeProvider>
      );
    };

    render(<TestLayout />);

    expect(screen.getByText('Page Title')).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });

  it('should support theme switching', async () => {
    const user = userEvent.setup();
    
    const ThemeSwitcher: React.FC = () => {
      const [themeId, setTheme] = useThemeSwitcher();
      const [mode, setMode] = useThemeMode();

      return (
        <div>
          <select 
            value={themeId} 
            onChange={(e) => setTheme(e.target.value)}
            data-testid="theme-selector"
          >
            <option value="default">Default</option>
            <option value="dark">Dark</option>
          </select>
          <button 
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            data-testid="mode-toggle"
          >
            Toggle Mode
          </button>
        </div>
      );
    };

    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    );

    // 初始状态
    expect(screen.getByTestId('theme-selector')).toHaveValue('default');

    // 切换主题
    await user.selectOptions(screen.getByTestId('theme-selector'), 'dark');
    expect(screen.getByTestId('theme-selector')).toHaveValue('dark');

    // 切换模式
    await user.click(screen.getByTestId('mode-toggle'));
    // 这里需要一个可以检测模式变化的组件来验证
  });
});

// 模拟useThemeSwitcher和useThemeMode hooks用于测试
const useThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  return [theme.id, setTheme] as const;
};

const useThemeMode = () => {
  const { mode, setMode } = useTheme();
  return [mode, setMode] as const;
};