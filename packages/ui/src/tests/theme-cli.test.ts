/**
 * 主题CLI工具测试
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Theme CLI Tools', () => {
  const testOutputDir = path.join(__dirname, 'test-output');
  
  beforeAll(() => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试输出目录
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Theme Generator', () => {
    it('should list builtin themes', () => {
      const output = execSync('node -e "require(\'../tools/theme-generator\').default"', {
        cwd: path.join(__dirname, '..'),
      }).toString();
      
      expect(output).toContain('内置主题列表');
      expect(output).toContain('default');
      expect(output).toContain('dark');
    });

    it('should export theme to JSON', () => {
      const outputFile = path.join(testOutputDir, 'exported-theme.json');
      
      expect(() => {
        execSync(`node -e "require('../tools/theme-generator').default" export default -f json -o ${outputFile}`, {
          cwd: path.join(__dirname, '..'),
        });
      }).not.toThrow();

      // 验证输出文件
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const content = fs.readFileSync(outputFile, 'utf8');
      const theme = JSON.parse(content);
      expect(theme.id).toBe('default');
      expect(theme.name).toBe('Default');
    });

    it('should export theme to CSS', () => {
      const outputFile = path.join(testOutputDir, 'exported-theme.css');
      
      expect(() => {
        execSync(`node -e "require('../tools/theme-generator').default" export default -f css -o ${outputFile}`, {
          cwd: path.join(__dirname, '..'),
        });
      }).not.toThrow();

      // 验证输出文件
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content).toContain(':root');
      expect(content).toContain('--color-white');
    });

    it('should create custom theme', () => {
      const outputFile = path.join(testOutputDir, 'custom-theme.json');
      
      expect(() => {
        execSync(`node -e "require('../tools/theme-generator').default" create "My Custom Theme" -o ${outputFile}`, {
          cwd: path.join(__dirname, '..'),
        });
      }).not.toThrow();

      // 验证输出文件
      expect(fs.existsSync(outputFile)).toBe(true);
      
      const content = fs.readFileSync(outputFile, 'utf8');
      const theme = JSON.parse(content);
      expect(theme.name).toBe('My Custom Theme');
      expect(theme.id).toBe('my-custom-theme');
    });
  });

  describe('Theme Validator', () => {
    it('should validate valid theme file', () => {
      const validThemeFile = path.join(testOutputDir, 'valid-theme.json');
      
      // 创建一个有效的主题文件
      const validTheme = {
        id: 'test-theme',
        name: 'Test Theme',
        description: 'A test theme',
        version: '1.0.0',
        author: 'Test Author',
        isDark: false,
        tokens: {
          colors: {
            base: {
              white: '#FFFFFF',
              black: '#000000',
              gray: {
                50: '#F9FAFB',
                100: '#F3F4F6',
                200: '#E5E7EB',
                300: '#D1D5DB',
                400: '#9CA3AF',
                500: '#6B7280',
                600: '#4B5563',
                700: '#374151',
                800: '#1F2937',
                900: '#111827',
              },
              neutral: {
                50: '#FAFAFA',
                100: '#F5F5F5',
                200: '#E5E5E5',
                300: '#D4D4D4',
                400: '#A3A3A3',
                500: '#737373',
                600: '#525252',
                700: '#404040',
                800: '#262626',
                900: '#171717',
              },
            },
            semantic: {
              primary: {
                50: '#EFF6FF',
                100: '#DBEAFE',
                200: '#BFDBFE',
                300: '#93C5FD',
                400: '#60A5FA',
                500: '#3B82F6',
                600: '#2563EB',
                700: '#1D4ED8',
                800: '#1E40AF',
                900: '#1E3A8A',
              },
              secondary: {
                50: '#F3F4F6',
                100: '#E5E7EB',
                200: '#D1D5DB',
                300: '#9CA3AF',
                400: '#6B7280',
                500: '#4B5563',
                600: '#374151',
                700: '#1F2937',
                800: '#111827',
                900: '#030712',
              },
              accent: {
                50: '#FEF3C7',
                100: '#FDE68A',
                200: '#FCD34D',
                300: '#FBBF24',
                400: '#F59E0B',
                500: '#F97316',
                600: '#EA580C',
                700: '#C2410C',
                800: '#9A3412',
                900: '#7C2D12',
              },
              success: {
                50: '#F0FDF4',
                100: '#DCFCE7',
                200: '#BBF7D0',
                300: '#86EFAC',
                400: '#4ADE80',
                500: '#22C55E',
                600: '#16A34A',
                700: '#15803D',
                800: '#166534',
                900: '#14532D',
              },
              warning: {
                50: '#FFFBEB',
                100: '#FEF3C7',
                200: '#FDE68A',
                300: '#FCD34D',
                400: '#FBBF24',
                500: '#F59E0B',
                600: '#D97706',
                700: '#B45309',
                800: '#92400E',
                900: '#78350F',
              },
              error: {
                50: '#FEF2F2',
                100: '#FEE2E2',
                200: '#FECACA',
                300: '#FCA5A5',
                400: '#F87171',
                500: '#EF4444',
                600: '#DC2626',
                700: '#B91C1C',
                800: '#991B1B',
                900: '#7F1D1D',
              },
              info: {
                50: '#EFF6FF',
                100: '#DBEAFE',
                200: '#BFDBFE',
                300: '#93C5FD',
                400: '#60A5FA',
                500: '#3B82F6',
                600: '#2563EB',
                700: '#1D4ED8',
                800: '#1E40AF',
                900: '#1E3A8A',
              },
            },
            functional: {
              background: {
                primary: '#FFFFFF',
                secondary: '#F9FAFB',
                tertiary: '#F3F4F6',
                surface: '#FFFFFF',
                hover: '#F3F4F6',
                active: '#E5E7EB',
                disabled: '#F9FAFB',
                overlay: 'rgba(0, 0, 0, 0.5)',
              },
              text: {
                primary: '#111827',
                secondary: '#6B7280',
                tertiary: '#9CA3AF',
                inverse: '#FFFFFF',
                disabled: '#D1D5DB',
                link: '#3B82F6',
                code: '#E5E7EB',
              },
              border: {
                default: '#E5E7EB',
                hover: '#D1D5DB',
                focus: '#3B82F6',
                interactive: '#60A5FA',
                disabled: '#F3F4F6',
              },
              icon: {
                primary: '#374151',
                secondary: '#6B7280',
                inverse: '#FFFFFF',
                disabled: '#D1D5DB',
                active: '#3B82F6',
              },
              interactive: {
                hover: '#F3F4F6',
                active: '#E5E7EB',
                focus: '#DBEAFE',
                selected: '#3B82F6',
                disabled: '#F9FAFB',
              },
            },
            theme: {
              light: {
                background: '#FFFFFF',
                surface: '#F9FAFB',
                text: '#111827',
                subtext: '#6B7280',
                border: '#E5E7EB',
                divider: '#F3F4F6',
                highlight: '#FEF3C7',
                shadow: 'rgba(0, 0, 0, 0.1)',
              },
              dark: {
                background: '#111827',
                surface: '#1F2937',
                text: '#F9FAFB',
                subtext: '#9CA3AF',
                border: '#374151',
                divider: '#4B5563',
                highlight: '#374151',
                shadow: 'rgba(255, 255, 255, 0.1)',
              },
            },
          },
          typography: {
            fontFamily: {
              sans: ['Inter', 'system-ui', 'sans-serif'],
              serif: ['Georgia', 'Times New Roman', 'serif'],
              mono: ['Consolas', 'Monaco', 'monospace'],
              display: ['Oswald', 'Arial', 'sans-serif'],
            },
            fontSize: {
              xs: 0.75,
              sm: 0.875,
              base: 1,
              lg: 1.125,
              xl: 1.25,
              '2xl': 1.5,
              '3xl': 1.875,
              '4xl': 2.25,
              '5xl': 3,
              '6xl': 3.75,
            },
            fontWeight: {
              thin: 100,
              light: 300,
              normal: 400,
              medium: 500,
              semibold: 600,
              bold: 700,
              black: 900,
            },
            lineHeight: {
              none: 1,
              tight: 1.25,
              snuggly: 1.375,
              normal: 1.5,
              relaxed: 1.625,
              loose: 2,
            },
            letterSpacing: {
              tight: '-0.025em',
              normal: '0',
              wide: '0.025em',
            },
            textAlign: {
              left: 'left',
              center: 'center',
              right: 'right',
              justify: 'justify',
            },
            textTransform: {
              none: 'none',
              uppercase: 'uppercase',
              lowercase: 'lowercase',
              capitalize: 'capitalize',
            },
            textDecoration: {
              none: 'none',
              underline: 'underline',
              lineThrough: 'line-through',
              underlineLineThrough: 'underline line-through',
            },
          },
          spacing: {
            base: {
              none: 0,
              xs: 0.25,
              sm: 0.5,
              md: 1,
              lg: 1.5,
              xl: 2,
              '2xl': 3,
              '3xl': 4,
              '4xl': 6,
              '5xl': 8,
              '6xl': 12,
            },
            component: {
              padding: {
                xs: 0.5,
                sm: 1,
                md: 1.5,
                lg: 2,
                xl: 3,
              },
              margin: {
                xs: 0.5,
                sm: 1,
                md: 1.5,
                lg: 2,
                xl: 3,
              },
              gap: {
                xs: 0.5,
                sm: 1,
                md: 1.5,
                lg: 2,
                xl: 3,
              },
            },
            responsive: {
              phone: 0.75,
              tablet: 1,
              desktop: 1.5,
              widescreen: 2,
            },
          },
          border: {
            width: {
              none: 0,
              thin: 0.00625,
              normal: 0.0125,
              medium: 0.025,
              thick: 0.05,
            },
            style: {
              solid: 'solid',
              dashed: 'dashed',
              dotted: 'dotted',
              double: 'double',
            },
            radius: {
              none: 0,
              sm: 0.125,
              md: 0.25,
              lg: 0.375,
              xl: 0.5,
              '2xl': 0.75,
              '3xl': 1,
              full: 9999,
            },
            opacity: {
              light: 0.1,
              normal: 0.2,
              heavy: 0.3,
            },
          },
          shadow: {
            box: {
              none: 'none',
              sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
            },
            text: {
              none: 'none',
              sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
              md: '0 1px 3px rgba(0, 0, 0, 0.2)',
              lg: '0 2px 4px rgba(0, 0, 0, 0.3)',
            },
            colors: {
              ambient: 'rgba(0, 0, 0, 0.1)',
              light: 'rgba(255, 255, 255, 0.1)',
              dark: 'rgba(0, 0, 0, 0.3)',
              color: 'rgba(0, 0, 0, 0.2)',
            },
          },
          animation: {
            duration: {
              fastest: 100,
              fast: 200,
              normal: 300,
              slow: 400,
              slowest: 500,
            },
            easing: {
              linear: 'linear',
              easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
              easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
              easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
              bounceIn: 'cubic-bezier(0.6, -0.28, 0.735, 0.045)',
              bounceOut: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              elasticIn: 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
              elasticOut: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            },
            delay: {
              none: 0,
              xs: 50,
              sm: 100,
              md: 200,
              lg: 300,
            },
            type: {
              fadeIn: 'opacity',
              fadeOut: 'opacity',
              slideIn: 'transform',
              slideOut: 'transform',
              scaleIn: 'transform scale',
              scaleOut: 'transform scale',
              rotateIn: 'transform rotate',
              rotateOut: 'transform rotate',
            },
          },
          layout: {
            breakpoints: {
              xs: 0,
              sm: 640,
              md: 768,
              lg: 1024,
              xl: 1280,
              '2xl': 1536,
            },
            container: {
              sm: 640,
              md: 768,
              lg: 1024,
              xl: 1280,
              full: '100%',
            },
            grid: {
              columns: 12,
              gutter: 16,
              maxWidth: 1280,
            },
            columns: {
              1: 1,
              2: 2,
              3: 3,
              4: 4,
              6: 6,
              8: 8,
              12: 12,
              24: 24,
            },
          },
          gradient: {
            linear: {
              primary: 'linear-gradient(to right, #3B82F6, #1D4ED8)',
              secondary: 'linear-gradient(to right, #6B7280, #374151)',
              success: 'linear-gradient(to right, #22C55E, #15803D)',
              warning: 'linear-gradient(to right, #F59E0B, #B45309)',
              error: 'linear-gradient(to right, #EF4444, #B91C1C)',
              info: 'linear-gradient(to right, #3B82F6, #1D4ED8)',
              subtle: 'linear-gradient(to right, #F3F4F6, #E5E7EB)',
              strong: 'linear-gradient(to right, #111827, #030712)',
            },
            radial: {
              primary: 'radial-gradient(circle, #3B82F6, #1D4ED8)',
              secondary: 'radial-gradient(circle, #6B7280, #374151)',
              success: 'radial-gradient(circle, #22C55E, #15803D)',
              warning: 'radial-gradient(circle, #F59E0B, #B45309)',
              error: 'radial-gradient(circle, #EF4444, #B91C1C)',
              info: 'radial-gradient(circle, #3B82F6, #1D4ED8)',
              subtle: 'radial-gradient(circle, #F3F4F6, #E5E7EB)',
              strong: 'radial-gradient(circle, #111827, #030712)',
            },
            directions: {
              toTop: 'to top',
              toRight: 'to right',
              toBottom: 'to bottom',
              toLeft: 'to left',
              toTopRight: 'to top right',
              toTopLeft: 'to top left',
              toBottomRight: 'to bottom right',
              toBottomLeft: 'to bottom left',
            },
          },
        },
        customTokens: {},
        components: {},
      };
      
      fs.writeFileSync(validThemeFile, JSON.stringify(validTheme, null, 2));
      
      const output = execSync(`node -e "require('../tools/theme-generator').default" validate ${validThemeFile}`, {
        cwd: path.join(__dirname, '..'),
      }).toString();
      
      expect(output).toContain('主题验证通过');
    });

    it('should detect invalid theme file', () => {
      const invalidThemeFile = path.join(testOutputDir, 'invalid-theme.json');
      
      // 创建一个无效的主题文件（缺少必需字段）
      const invalidTheme = {
        name: 'Invalid Theme', // 缺少id字段
        // 缺少其他必需字段
      };
      
      fs.writeFileSync(invalidThemeFile, JSON.stringify(invalidTheme, null, 2));
      
      const output = execSync(`node -e "require('../tools/theme-generator').default" validate ${invalidThemeFile}`, {
        cwd: path.join(__dirname, '..'),
      }).toString();
      
      expect(output).toContain('主题验证失败');
    });
  });

  describe('Theme Tester', () => {
    it('should run all tests successfully', () => {
      const output = execSync('node -e "require(\'../tools/theme-tester\').default"', {
        cwd: path.join(__dirname, '..'),
      }).toString();
      
      expect(output).toContain('开始主题系统测试');
      expect(output).toContain('测试结果');
    });
  });

  describe('Theme Documenter', () => {
    it('should generate documentation', () => {
      const docsDir = path.join(testOutputDir, 'docs');
      
      expect(() => {
        execSync(`node -e "require('../tools/theme-documenter\').default"`, {
          cwd: path.join(__dirname, '..'),
          env: { ...process.env, OUTPUT_DIR: docsDir },
        });
      }).not.toThrow();

      // 验证生成的文档文件
      expect(fs.existsSync(path.join(docsDir, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(docsDir, 'themes'))).toBe(true);
      expect(fs.existsSync(path.join(docsDir, 'tokens'))).toBe(true);
    });
  });
});