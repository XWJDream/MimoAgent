export type PermissionMode = 'suggest' | 'auto-edit' | 'full-auto';
export interface SandboxConfig {
    enabled: boolean;
    image: string;
    memoryLimit: string;
    cpuLimit: number;
    networkEnabled: boolean;
    timeout: number;
}
export interface SubAgentConfig {
    enabled: boolean;
    maxConcurrent: number;
}
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
/** 单个 Provider 配置 */
export interface ProviderConfig {
    name?: string;
    models?: ModelInfo[];
    defaultModel?: string;
}
/** 多 Provider 配置（按名称索引） */
export type ProvidersConfig = Record<string, {
    apiKey?: string;
    baseUrl?: string;
    models?: ModelInfo[];
}>;
export interface MimoConfig {
    model: string;
    apiBase: string;
    apiKey: string;
    maxTokens: number;
    temperature: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
    contextWindow: number;
    permissionMode: PermissionMode;
    allowedTools: string[];
    blockedTools: string[];
    allowedPaths: string[];
    maxTurns: number;
    systemPromptAppend?: string;
    disableDefaultTools: string[];
    sandbox: SandboxConfig;
    theme: 'dark' | 'light';
    stream: boolean;
    verbose: boolean;
    subAgents: SubAgentConfig;
    /** 单 Provider 配置 */
    provider?: ProviderConfig;
    /** 多 Provider 配置（按名称索引） */
    providers?: ProvidersConfig;
}
