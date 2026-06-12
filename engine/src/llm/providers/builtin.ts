import type { LLMProvider, ProviderConfig, ILLMClient } from './types.js';
import { LLMClient } from '../client.js';

/**
 * 创建 OpenAI 兼容客户端适配器
 * 将现有 LLMClient 适配为 ILLMClient 接口
 */
function createOpenAICompatibleClient(config: ProviderConfig): ILLMClient {
  const client = new LLMClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.defaultModel || 'default',
    maxTokens: 4096,
    temperature: 0.2,
    timeout: config.timeout || 30000,
  });

  return {
    chat: (messages, tools, signal) => client.chat(messages, tools, signal),
    chatStream: (messages, tools, signal) => client.chatStream(messages, tools, signal),
  };
}

/**
 * 验证 API Key（通用方法）
 * 通过发送一个最小请求来验证
 */
async function validateApiKey(apiKey: string, baseUrl: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    // 200-299 = 有效, 401 = key 无效, 其他状态码 = 不确定（保守返回 false）
    return response.ok;
  } catch {
    // 网络错误时无法验证，返回 true（不阻塞用户）
    return true;
  }
}

/** OpenAI 兼容 Provider（适用于大多数国产模型和 OpenAI API 兼容服务） */
export const openaiCompatibleProvider: LLMProvider = {
  name: 'openai-compatible',
  models: [], // 动态加载
  createClient: (config) => createOpenAICompatibleClient(config),
  validateAuth: async (apiKey) => !!apiKey,
};

/** MiMo Provider */
export const mimoProvider: LLMProvider = {
  name: 'mimo',
  models: [
    {
      id: 'mimo-v2.5-pro',
      name: 'MiMo v2.5 Pro',
      contextWindow: 1_048_576,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsStreaming: true,
    },
    {
      id: 'mimo-v2.5',
      name: 'MiMo v2.5',
      contextWindow: 262_144,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsStreaming: true,
    },
  ],
  createClient: (config) => createOpenAICompatibleClient(config),
  validateAuth: async (apiKey) => !!apiKey,
};

/** OpenAI Provider */
export const openaiProvider: LLMProvider = {
  name: 'openai',
  models: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStreaming: true,
      costPer1kInput: 2.5,
      costPer1kOutput: 10,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128_000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStreaming: true,
      costPer1kInput: 0.15,
      costPer1kOutput: 0.6,
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128_000,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsStreaming: true,
      costPer1kInput: 10,
      costPer1kOutput: 30,
    },
  ],
  createClient: (config) => createOpenAICompatibleClient(config),
  validateAuth: async (apiKey) => validateApiKey(apiKey, 'https://api.openai.com/v1'),
};

/** Anthropic Provider（通过 OpenAI 兼容层） */
export const anthropicProvider: LLMProvider = {
  name: 'anthropic',
  models: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      contextWindow: 200_000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStreaming: true,
      costPer1kInput: 3,
      costPer1kOutput: 15,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      contextWindow: 200_000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStreaming: true,
      costPer1kInput: 0.8,
      costPer1kOutput: 4,
    },
  ],
  createClient: (config) => createOpenAICompatibleClient(config),
  validateAuth: async (apiKey) => !!apiKey,
};

/** 所有内置 Provider */
export const builtinProviders: LLMProvider[] = [
  mimoProvider,
  openaiProvider,
  anthropicProvider,
  openaiCompatibleProvider,
];
