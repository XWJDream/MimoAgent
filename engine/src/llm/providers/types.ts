/**
 * Multi-Provider 类型定义
 * 支持多种 LLM Provider 的统一接口
 */

/** 模型信息 */
export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

/** Provider 配置 */
export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: ModelInfo[];
  defaultModel?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/** LLM 客户端接口 */
export interface ILLMClient {
  chat(messages: any[], tools?: any[], signal?: AbortSignal): Promise<any>;
  chatStream(messages: any[], tools?: any[], signal?: AbortSignal): AsyncGenerator<any>;
}

/** LLM Provider 接口 */
export interface LLMProvider {
  name: string;
  models: ModelInfo[];
  createClient(config: ProviderConfig): ILLMClient;
  validateAuth(apiKey: string): Promise<boolean>;
}

/** MimoConfig 中的 Provider 配置 */
export interface ProviderMimoConfig {
  /** 当前使用的 Provider 名称 */
  name?: string;
  /** 自定义模型列表 */
  models?: ModelInfo[];
  /** 默认模型 */
  defaultModel?: string;
}

/** 多 Provider 配置（按名称索引） */
export type ProvidersConfig = Record<string, {
  apiKey?: string;
  baseUrl?: string;
  models?: ModelInfo[];
}>;
