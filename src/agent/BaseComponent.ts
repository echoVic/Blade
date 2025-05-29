import { Component } from './Agent.js';

/**
 * 组件基类
 * 提供组件的基本实现，可被具体组件继承
 */
export abstract class BaseComponent implements Component {
  private _name: string;

  constructor(name: string) {
    this._name = name;
  }

  /**
   * 获取组件名称
   */
  get name(): string {
    return this._name;
  }

  /**
   * 初始化组件
   * 子类应重写此方法实现具体的初始化逻辑
   */
  public async init(): Promise<void> {
    // 基础实现，子类应重写
  }

  /**
   * 销毁组件
   * 子类应重写此方法实现具体的销毁逻辑
   */
  public async destroy(): Promise<void> {
    // 基础实现，子类应重写
  }
} 