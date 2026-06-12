import type { LLMProvider, ModelInfo } from './types.js';

/**
 * Provider 注册中心
 * 管理所有已注册的 LLM Provider
 */
export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  /**
   * 注册 Provider
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * 获取 Provider
   */
  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * 列出所有 Provider
   */
  list(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 列出所有 Provider 名称
   */
  listNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 列出所有可用模型
   */
  listAllModels(): Array<{ provider: string; model: ModelInfo }> {
    const models: Array<{ provider: string; model: ModelInfo }> = [];
    for (const provider of this.providers.values()) {
      for (const model of provider.models) {
        models.push({ provider: provider.name, model });
      }
    }
    return models;
  }

  /**
   * 根据模型 ID 查找 Provider
   */
  findProviderForModel(modelId: string): { provider: LLMProvider; model: ModelInfo } | undefined {
    for (const provider of this.providers.values()) {
      const model = provider.models.find(m => m.id === modelId);
      if (model) return { provider, model };
    }
    return undefined;
  }

  /**
   * 移除 Provider
   */
  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * 检查 Provider 是否已注册
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * 清空所有 Provider
   */
  clear(): void {
    this.providers.clear();
  }
}

/** 全局 Provider 注册中心实例 */
export const globalProviderRegistry = new ProviderRegistry();
