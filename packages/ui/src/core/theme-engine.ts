/**
 * 主题引擎核心实现
 * 提供主题管理、切换、验证和扩展功能
 */

import { EventEmitter } from 'events';
import type { DeepPartial, DesignTokens, ThemeValidationResult } from '../types/design-tokens';
import type {
  ThemeAdapter,
  ThemeConfig,
  ThemeContext,
  ThemeEngineConfig,
  ThemeEngineOptions,
  ThemeEvent,
  ThemeFactory,
  ThemeHooks,
  ThemeMode,
  ThemePerformanceMetrics,
  ThemePerformanceMonitor,
  ThemePreset,
  ThemeProcessor,
  ThemeStorage,
  ThemeTransformer,
  ThemeValidator,
  ThemeVariant,
} from '../types/theme-engine';
import { DesignTokenSystem } from './design-token-system';

export class ThemeEngine extends EventEmitter {
  private config: Required<ThemeEngineConfig>;
  private currentTheme: ThemeConfig | null = null;
  private currentMode: keyof ThemeMode = 'light';
  private currentVariant: ThemeVariant | null = null;
  private themes: Map<string, ThemeConfig> = new Map();
  private variants: Map<string, ThemeVariant> = new Map();
  private presets: Map<string, ThemePreset> = new Map();
  private contextChain: ThemeContext[] = [];
  private tokenSystem: DesignTokenSystem;
  private storage: ThemeStorage;
  private adapters: Map<string, ThemeAdapter> = new Map();
  private processors: Map<string, ThemeProcessor> = new Map();
  private transformers: Map<string, ThemeTransformer> = new Map();
  private validators: Map<string, ThemeValidator> = new Map();
  private factory: ThemeFactory;
  private hooks: ThemeHooks;
  private performanceMonitor: ThemePerformanceMonitor;
  private isInitialized: boolean = false;
  private eventQueue: ThemeEvent[] = [];
  private isProcessing: boolean = false;

  constructor(options?: ThemeEngineOptions) {
    super();

    this.config = this.mergeConfig(options?.config || {});
    this.tokenSystem = new DesignTokenSystem();
    this.storage = options?.storage || this.createDefaultStorage();
    this.factory = options?.factory || this.createDefaultFactory();
    this.hooks = options?.hooks || {};
    this.performanceMonitor = options?.performance || this.createDefaultPerformanceMonitor();

    this.initializeComponents(options);
    this.initializeEventHandlers();
  }

  /**
   * 初始化主题引擎
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadPresets();
      await this.loadThemes();
      await this.applyDefaultTheme();
      this.startEventProcessing();

      this.isInitialized = true;
      this.emit('initialized');

      if (this.hooks.onThemeInit) {
        await this.hooks.onThemeInit(this.currentTheme!);
      }
    } catch (error) {
      this.handleError('Failed to initialize theme engine', error);
      throw error;
    }
  }

  /**
   * 销毁主题引擎
   */
  public async destroy(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.isInitialized = false;
      this.stopEventProcessing();

      if (this.currentTheme && this.hooks.onThemeDestroy) {
        await this.hooks.onThemeDestroy(this.currentTheme);
      }

      await this.storage.clear();
      this.removeAllListeners();
      this.clearCache();

      this.emit('destroyed');
    } catch (error) {
      this.handleError('Failed to destroy theme engine', error);
      throw error;
    }
  }

  /**
   * 设置主题
   */
  public async setTheme(
    themeId: string,
    options?: { mode?: keyof ThemeMode; variantId?: string }
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Theme engine is not initialized');
    }

    const theme = await this.loadTheme(themeId);
    if (!theme) {
      throw new Error(`Theme '${themeId}' not found`);
    }

    const oldTheme = this.currentTheme;
    const oldMode = this.currentMode;
    const oldVariant = this.currentVariant;

    if (this.hooks.beforeThemeChange) {
      const shouldContinue = await this.hooks.beforeThemeChange(oldTheme, theme);
      if (!shouldContinue) {
        return;
      }
    }

    this.performanceMonitor.start();

    try {
      // 设置新模式
      if (options?.mode) {
        this.currentMode = options.mode;
      }

      // 设置新变体
      if (options?.variantId) {
        this.currentVariant = await this.loadVariant(options.variantId);
      }

      // 应用主题
      await this.applyTheme(theme);
      this.currentTheme = theme;

      // 发送事件
      this.emitEvent({
        type: 'theme:changed',
        timestamp: Date.now(),
        data: {
          oldTheme: oldTheme?.id,
          newTheme: theme.id,
          oldMode,
          newMode: this.currentMode,
        },
      });

      if (this.hooks.afterThemeChange) {
        await this.hooks.afterThemeChange(oldTheme, theme);
      }

      this.performanceMonitor.stop();
    } catch (error) {
      this.handleError('Failed to set theme', error);
      throw error;
    }
  }

  /**
   * 获取当前主题
   */
  public getCurrentTheme(): ThemeConfig | null {
    return this.currentTheme;
  }

  /**
   * 获取当前模式
   */
  public getCurrentMode(): keyof ThemeMode {
    return this.currentMode;
  }

  /**
   * 获取当前变体
   */
  public getCurrentVariant(): ThemeVariant | null {
    return this.currentVariant;
  }

  /**
   * 添加主题
   */
  public async addTheme(theme: ThemeConfig): Promise<void> {
    await this.validateTheme(theme);
    await this.storage.save(theme);
    this.themes.set(theme.id, theme);

    // 应用主题处理器
    for (const processor of this.processors.values()) {
      theme.tokens = processor.process(theme.tokens);
    }

    this.emitEvent({
      type: 'theme:created',
      timestamp: Date.now(),
      data: { theme },
    });
  }

  /**
   * 移除主题
   */
  public async removeTheme(themeId: string): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) {
      throw new Error(`Theme '${themeId}' not found`);
    }

    if (theme.id === this.currentTheme?.id) {
      throw new Error('Cannot remove the current theme');
    }

    await this.storage.delete(themeId);
    this.themes.delete(themeId);

    this.emitEvent({
      type: 'theme:deleted',
      timestamp: Date.now(),
      data: { themeId },
    });
  }

  /**
   * 获取所有可用主题
   */
  public getAvailableThemes(): ThemeConfig[] {
    return Array.from(this.themes.values());
  }

  /**
   * 获取主题令牌
   */
  public getToken(tokenPath: string): any {
    if (!this.currentTheme) {
      throw new Error('No theme is currently active');
    }

    const startTime = performance.now();
    const value = this.tokenSystem.getToken(tokenPath);
    const endTime = performance.now();

    this.emitEvent({
      type: 'theme:token:accessed',
      timestamp: Date.now(),
      data: { tokenPath, value, accessTime: endTime - startTime },
    });

    if (this.hooks.onTokenAccess) {
      this.hooks.onTokenAccess(tokenPath, value);
    }

    return value;
  }

  /**
   * 创建主题变体
   */
  public async createVariant(
    baseThemeId: string,
    variant: Omit<ThemeVariant, 'parentTheme'>
  ): Promise<ThemeVariant> {
    const baseTheme = this.themes.get(baseThemeId);
    if (!baseTheme) {
      throw new Error(`Base theme '${baseThemeId}' not found`);
    }

    const newVariant: ThemeVariant = {
      ...variant,
      parentTheme: baseThemeId,
    };

    this.variants.set(variant.id, newVariant);
    return newVariant;
  }

  /**
   * 应用主题变体
   */
  public async applyVariant(variantId: string): Promise<void> {
    const variant = this.variants.get(variantId);
    if (!variant) {
      throw new Error(`Variant '${variantId}' not found`);
    }

    const baseTheme = this.themes.get(variant.parentTheme);
    if (!baseTheme) {
      throw new Error(`Base theme '${variant.parentTheme}' not found`);
    }

    // 合并变体令牌到基础主题
    const mergedTokens = this.mergeTokens(baseTheme.tokens, variant.tokens);
    const variantTheme: ThemeConfig = {
      ...baseTheme,
      tokens: mergedTokens,
      id: `${baseTheme.id}-${variant.id}`,
      name: `${baseTheme.name} - ${variant.name}`,
    };

    await this.applyTheme(variantTheme);
    this.currentVariant = variant;

    this.emitEvent({
      type: 'theme:variant:applied',
      timestamp: Date.now(),
      data: { variantId, baseThemeId: baseTheme.id },
    });
  }

  /**
   * 创建主题上下文
   */
  public createContext(scope: ThemeContext['scope'] = 'local'): ThemeContext {
    const context: ThemeContext = {
      currentTheme: this.currentTheme!,
      currentMode: this.currentMode,
      currentVariant: this.currentVariant || undefined,
      parent: this.contextChain[this.contextChain.length - 1] || null,
      children: [],
      scope,
      level: this.contextChain.length,
      isActive: true,
    };

    if (context.parent) {
      context.parent.children.push(context);
    }

    this.contextChain.push(context);
    return context;
  }

  /**
   * 销毁主题上下文
   */
  public destroyContext(context: ThemeContext): void {
    const index = this.contextChain.indexOf(context);
    if (index > -1) {
      this.contextChain.splice(index, 1);
      context.isActive = false;
    }
  }

  /**
   * 获取性能指标
   */
  public getPerformanceMetrics(): ThemePerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * 重置性能指标
   */
  public resetPerformanceMetrics(): void {
    this.performanceMonitor.reset();
  }

  /**
   * 验证主题
   */
  public async validateTheme(theme: ThemeConfig): Promise<ThemeValidationResult> {
    let result: ThemeValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: [],
    };

    // 运行所有验证器
    for (const validator of this.validators.values()) {
      const validatorResult = validator.validate(theme);
      result = this.mergeValidationResults(result, validatorResult);
    }

    return result;
  }

  /**
   * 转换主题到指定格式
   */
  public convertTheme(theme: ThemeConfig, format: string): any {
    const transformer = this.transformers.get(format);
    if (!transformer) {
      throw new Error(`Transformer for format '${format}' not found`);
    }

    return transformer.transform(theme.tokens, format);
  }

  /**
   * 注册适配器
   */
  public registerAdapter(name: string, adapter: ThemeAdapter): void {
    this.adapters.set(name, adapter);
  }

  /**
   * 注册处理器
   */
  public registerProcessor(name: string, processor: ThemeProcessor): void {
    this.processors.set(name, processor);
  }

  /**
   * 注册转换器
   */
  public registerTransformer(name: string, transformer: ThemeTransformer): void {
    this.transformers.set(name, transformer);
  }

  /**
   * 注册验证器
   */
  public registerValidator(name: string, validator: ThemeValidator): void {
    this.validators.set(name, validator);
  }

  /**
   * 私有方法实现
   */

  private mergeConfig(config: ThemeEngineConfig): Required<ThemeEngineConfig> {
    return {
      defaultTheme: config.defaultTheme || 'default',
      defaultMode: config.defaultMode || 'light',
      enableCSSVariables: config.enableCSSVariables ?? true,
      enableHotReload: config.enableHotReload ?? false,
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL || 300000, // 5分钟
      validationLevel: config.validationLevel || 'normal',
      debug: config.debug ?? false,
      optimizePerformance: config.optimizePerformance ?? true,
      customTokenHandlers: config.customTokenHandlers || {},
    };
  }

  private createDefaultStorage(): ThemeStorage {
    return new MemoryStorage();
  }

  private createDefaultFactory(): ThemeFactory {
    return new ThemeFactoryImpl();
  }

  private createDefaultPerformanceMonitor(): ThemePerformanceMonitor {
    return new PerformanceMonitorImpl();
  }

  private initializeComponents(options?: ThemeEngineOptions): void {
    if (options?.adapters) {
      options.adapters.forEach(adapter => {
        this.adapters.set(adapter.getName(), adapter);
      });
    }

    if (options?.processors) {
      options.processors.forEach(processor => {
        this.processors.set(processor.getName(), processor);
      });
    }

    if (options?.transformers) {
      options.transformers.forEach(transformer => {
        this.transformers.set(transformer.getName(), transformer);
      });
    }

    if (options?.validators) {
      options.validators.forEach(validator => {
        this.validators.set(validator.getName(), validator);
      });
    }
  }

  private initializeEventHandlers(): void {
    this.on('theme:changed', this.handleThemeChange.bind(this));
    this.on('theme:token:accessed', this.handleTokenAccess.bind(this));
  }

  private async loadPresets(): Promise<void> {
    // 加载内置预设和用户预设
    const builtInPresets = this.getBuiltInPresets();
    const userPresets = await this.storage.list();

    [...builtInPresets, ...userPresets].forEach(preset => {
      this.presets.set(preset.id, preset);
    });
  }

  private async loadThemes(): Promise<void> {
    const themes = await this.storage.list();
    themes.forEach(theme => {
      this.themes.set(theme.id, theme);
    });
  }

  private async applyDefaultTheme(): Promise<void> {
    if (this.config.defaultTheme) {
      try {
        await this.setTheme(this.config.defaultTheme, {
          mode: this.config.defaultMode,
        });
      } catch (error) {
        this.handleError('Failed to apply default theme', error);
      }
    }
  }

  private async loadTheme(themeId: string): Promise<ThemeConfig | null> {
    let theme = this.themes.get(themeId);
    if (!theme) {
      theme = await this.storage.load(themeId);
      if (theme) {
        this.themes.set(themeId, theme);
      }
    }
    return theme;
  }

  private async loadVariant(variantId: string): Promise<ThemeVariant | null> {
    return this.variants.get(variantId) || null;
  }

  private async applyTheme(theme: ThemeConfig): Promise<void> {
    // 应用到所有适配器
    for (const adapter of this.adapters.values()) {
      adapter.apply(theme);
    }

    // 更新令牌系统
    this.tokenSystem = new DesignTokenSystem(theme.tokens);
  }

  private emitEvent(event: ThemeEvent): void {
    this.eventQueue.push(event);
    this.processEvents();
  }

  private startEventProcessing(): void {
    this.isProcessing = true;
    this.processEvents();
  }

  private stopEventProcessing(): void {
    this.isProcessing = false;
  }

  private processEvents(): void {
    if (!this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    const event = this.eventQueue.shift()!;
    this.emit(event.type, event);

    if (this.eventQueue.length > 0) {
      setImmediate(() => this.processEvents());
    }
  }

  private handleThemeChange(event: ThemeEvent): void {
    if (this.config.enableHotReload) {
      this.handleHotReload(event.data);
    }
  }

  private handleTokenAccess(event: ThemeEvent): void {
    if (this.config.optimizePerformance) {
      this.optimizeTokenAccess(event.data);
    }
  }

  private handleHotReload(data: any): void {
    // 热重载实现
    this.debug('Hot reload triggered:', data);
  }

  private optimizeTokenAccess(data: any): void {
    // 性能优化实现
    this.debug('Token access optimization:', data);
  }

  private mergeTokens(target: DesignTokens, source: DeepPartial<DesignTokens>): DesignTokens {
    const merged = { ...target };
    this.deepMerge(merged, source);
    return merged;
  }

  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  private mergeValidationResults(
    a: ThemeValidationResult,
    b: ThemeValidationResult
  ): ThemeValidationResult {
    return {
      isValid: a.isValid && b.isValid,
      errors: [...a.errors, ...b.errors],
      warnings: [...a.warnings, ...b.warnings],
      recommendations: [...a.recommendations, ...b.recommendations],
    };
  }

  private clearCache(): void {
    this.tokenCache.clear();
    this.eventQueue.length = 0;
  }

  private handleError(message: string, error: any): void {
    this.debug('Theme Engine Error:', message, error);
    if (this.config.debug) {
      console.error(message, error);
    }
    this.emit('error', error);
  }

  private debug(...args: any[]): void {
    if (this.config.debug) {
      console.debug('[ThemeEngine]', ...args);
    }
  }

  private getBuiltInPresets(): ThemePreset[] {
    return [
      // 这里可以添加内置预设
    ];
  }

  private tokenCache: Map<string, any> = new Map();
}

// 内存存储实现
class MemoryStorage implements ThemeStorage {
  private themes: Map<string, ThemeConfig> = new Map();

  async save(theme: ThemeConfig): Promise<void> {
    this.themes.set(theme.id, theme);
  }

  async load(themeId: string): Promise<ThemeConfig | null> {
    return this.themes.get(themeId) || null;
  }

  async delete(themeId: string): Promise<void> {
    this.themes.delete(themeId);
  }

  async list(): Promise<ThemeConfig[]> {
    return Array.from(this.themes.values());
  }

  async exists(themeId: string): Promise<boolean> {
    return this.themes.has(themeId);
  }

  async clear(): Promise<void> {
    this.themes.clear();
  }

  async getStats(): Promise<any> {
    return {
      totalThemes: this.themes.size,
      totalSize: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// 主题工厂实现
class ThemeFactoryImpl implements ThemeFactory {
  create(options: Partial<ThemeConfig>): ThemeConfig {
    return {
      id: options.id || this.generateId(),
      name: options.name || 'New Theme',
      description: options.description || '',
      version: options.version || '1.0.0',
      author: options.author || 'Unknown',
      isDark: options.isDark || false,
      tokens: options.tokens || ({} as any),
      customTokens: options.customTokens || {},
      components: options.components || {},
    };
  }

  clone(theme: ThemeConfig): ThemeConfig {
    return JSON.parse(JSON.stringify(theme));
  }

  merge(target: ThemeConfig, source: Partial<ThemeConfig>): ThemeConfig {
    const merged = this.clone(target);
    Object.assign(merged, source);
    if (source.tokens) {
      this.deepMerge(merged.tokens, source.tokens);
    }
    return merged;
  }

  createFromPreset(presetId: string, overrides?: Partial<ThemeConfig>): ThemeConfig {
    // 实现从预设创建主题
    return this.create(overrides || {});
  }

  getAvailablePresets(): ThemePreset[] {
    return [];
  }

  private generateId(): string {
    return `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
}

// 性能监控实现
class PerformanceMonitorImpl implements ThemePerformanceMonitor {
  private metrics: ThemePerformanceMetrics = this.getDefaultMetrics();
  private startTime: number = 0;
  private isMonitoring: boolean = false;

  start(): void {
    this.startTime = performance.now();
    this.isMonitoring = true;
  }

  stop(): void {
    if (this.isMonitoring) {
      const endTime = performance.now();
      this.metrics.themeSwitchTime = endTime - this.startTime;
      this.isMonitoring = false;
    }
  }

  getMetrics(): ThemePerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = this.getDefaultMetrics();
    this.startTime = 0;
    this.isMonitoring = false;
  }

  private getDefaultMetrics(): ThemePerformanceMetrics {
    return {
      themeLoadTime: 0,
      themeSwitchTime: 0,
      tokenResolveTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      eventHandlerTime: 0,
      validationTime: 0,
      transformationTime: 0,
      totalRequests: 0,
      errorCount: 0,
      lastUpdated: new Date(),
    };
  }
}
