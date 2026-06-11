export interface IpcChannels {
    'agent:run': (prompt: string) => void;
    'agent:stop': () => void;
    'agent:clear': () => void;
    'agent:token': (token: string) => void;
    'agent:tool-start': (tool: {
        name: string;
        args: Record<string, unknown>;
    }) => void;
    'agent:tool-result': (result: {
        name: string;
        output: string;
        isError: boolean;
    }) => void;
    'agent:done': (usage: {
        tokens: number;
        cost: number;
    }) => void;
    'agent:error': (error: string) => void;
    'agent:thinking': () => void;
    'config:get': () => PublicAppConfig;
    'config:set': (key: string, value: unknown) => PublicAppConfig;
    'workspace:get': () => WorkspaceInfo;
    'workspace:set': (path: string) => WorkspaceInfo;
    'workspace:select': () => WorkspaceInfo | null;
    'session:list': () => Session[];
    'session:create': (name?: string) => Session;
    'session:switch': (id: string) => void;
    'session:delete': (id: string) => void;
    'session:rename': (id: string, name: string) => void;
    'session:set-workspace': (id: string, path: string) => Session;
    'sessions:save': (sessions: Session[]) => {
        success: boolean;
        error?: string;
    };
    'sessions:load': () => {
        sessions: Session[];
    };
    'memory:get': () => {
        content: string;
    };
    'memory:set': (content: string) => {
        success: boolean;
        error?: string;
    };
    'conversation:compact': () => {
        success: boolean;
        messageCount?: number;
        compacted?: boolean;
        error?: string;
    };
    'permission:request': (request: PermissionRequest) => void;
    'permission:response': (response: PermissionResponse) => void;
    'file:list': (path?: string) => FileTreeNode[];
    'file:read': (path: string) => string;
    'file:write': (path: string, content: string) => void;
    'file:dialog': () => string | null;
    'file:attachments-pick': () => ChatAttachment[];
    'shell:exec': (command: string) => ShellResult;
    'window:minimize': () => void;
    'window:maximize': () => void;
    'window:close': () => void;
}
export interface AppConfig {
    model: string;
    apiBase: string;
    apiKey: string;
    permissionMode: 'suggest' | 'auto-edit' | 'full-auto';
    maxTurns: number;
    temperature: number;
    theme: 'dark' | 'light' | 'sakura';
    selectedAvatarId: string;
    sandboxEnabled: boolean;
}
export interface PublicAppConfig extends Omit<AppConfig, 'apiKey'> {
    apiKeyConfigured: boolean;
    apiKeyPreview: string | null;
}
export interface WorkspaceInfo {
    path: string;
    name: string;
}
export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileTreeNode[];
}
export interface ChatAttachment {
    name: string;
    path: string;
    size: number;
    kind: 'image' | 'text' | 'file';
    content?: string;
}
export interface Session {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    workspacePath?: string;
    workspaceName?: string;
}
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolCalls?: ToolCallInfo[];
    toolResult?: ToolResultInfo;
}
export interface ToolCallInfo {
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: 'running' | 'done' | 'error';
    output?: string;
    duration?: number;
}
export interface ToolResultInfo {
    name: string;
    output: string;
    isError: boolean;
}
export interface ShellResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface UsageStats {
    sessionTokens: number;
    sessionCost: number;
    sessionToolCalls: number;
    totalTokens: number;
    totalCost: number;
    totalToolCalls: number;
}
export interface PermissionRequest {
    id: string;
    toolName: string;
    riskLevel: string;
    description: string;
    args: Record<string, unknown>;
}
export interface PermissionResponse {
    id: string;
    allowed: boolean;
    remember?: boolean;
}
