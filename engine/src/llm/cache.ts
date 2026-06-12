import type { ChatMessage } from './types.js';

/** 缓存控制标记 */
export interface CacheControl {
  type: 'ephemeral';
}

/** 带缓存控制的消息 */
export interface CachedChatMessage extends ChatMessage {
  cacheControl?: CacheControl;
}

/**
 * Prompt 缓存管理器
 * 在关键位置插入缓存断点，减少 API 成本
 *
 * 策略：
 * 1. System message 末尾（最大复用率）
 * 2. 对话中点（历史消息复用）
 * 3. 最后一条用户消息（当前上下文）
 *
 * 最多插入 3 个缓存断点，避免过多断点增加开销
 */
export class PromptCacheManager {
  /**
   * 为支持缓存的 API 插入缓存断点
   */
  static insertCacheBreakpoints(messages: ChatMessage[]): CachedChatMessage[] {
    if (messages.length === 0) return messages;

    const result: CachedChatMessage[] = messages.map(m => ({ ...m }));
    const indicesToCache = new Set<number>();

    // 1. System message 末尾
    const systemIdx = result.findIndex(m => m.role === 'system');
    if (systemIdx >= 0) {
      indicesToCache.add(systemIdx);
    }

    // 2. 对话中点（跳过 system message）
    const nonSystemMessages = result.filter(m => m.role !== 'system');
    if (nonSystemMessages.length >= 4) {
      const midIdx = Math.floor(result.length / 2);
      // 确保中点不是 system message 且不重复
      if (midIdx !== systemIdx && midIdx < result.length - 1) {
        indicesToCache.add(midIdx);
      }
    }

    // 3. 最后一条用户消息
    let lastUserIdx = -1;
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx >= 0 && lastUserIdx !== systemIdx) {
      indicesToCache.add(lastUserIdx);
    }

    // 应用缓存标记
    for (const idx of indicesToCache) {
      result[idx] = {
        ...result[idx],
        cacheControl: { type: 'ephemeral' },
      };
    }

    return result;
  }

  /**
   * 检查模型是否支持缓存
   */
  static supportsCaching(model: string): boolean {
    // Anthropic Claude 模型支持缓存
    if (model.startsWith('claude-')) return true;
    // DeepSeek 模型支持缓存（自动缓存，无需断点）
    if (model.startsWith('deepseek-')) return false; // 自动缓存，不需要手动断点
    // 其他模型默认不支持手动缓存断点
    return false;
  }

  /**
   * 计算缓存命中率
   */
  static calculateCacheHitRate(usage: { cachedTokens?: number; promptTokens: number }): number {
    if (!usage.cachedTokens || usage.promptTokens === 0) return 0;
    return usage.cachedTokens / usage.promptTokens;
  }

  /**
   * 格式化缓存命中率为百分比字符串
   */
  static formatCacheHitRate(usage: { cachedTokens?: number; promptTokens: number }): string {
    const rate = PromptCacheManager.calculateCacheHitRate(usage);
    return `${(rate * 100).toFixed(1)}%`;
  }

  /**
   * 估算缓存节省的 Token 数量
   */
  static estimateSavedTokens(usage: { cachedTokens?: number; promptTokens: number }): number {
    return usage.cachedTokens || 0;
  }
}
