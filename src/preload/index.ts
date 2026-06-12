import { contextBridge, ipcRenderer } from 'electron';

// Local IPC constants (synced with src/shared/ipc-channels.ts)
// Note: Cannot import from shared because preload uses CommonJS (tsconfig.preload.json)
// which would overwrite the ESM-compiled shared files in dist/
const IPC = {
  AGENT_RUN: 'agent:run',
  AGENT_STOP: 'agent:stop',
  AGENT_CLEAR: 'agent:clear',
  AGENT_TOKEN: 'agent:token',
  AGENT_TOOL_START: 'agent:tool-start',
  AGENT_TOOL_RESULT: 'agent:tool-result',
  AGENT_DONE: 'agent:done',
  AGENT_ERROR: 'agent:error',
  AGENT_THINKING: 'agent:thinking',
  AGENT_CONTEXT_PRESSURE: 'agent:context-pressure',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_SET: 'workspace:set',
  WORKSPACE_SELECT: 'workspace:select',
  SESSION_CREATE: 'session:create',
  SESSION_LIST: 'session:list',
  SESSION_SWITCH: 'session:switch',
  SESSION_DELETE: 'session:delete',
  SESSION_RENAME: 'session:rename',
  SESSION_SET_WORKSPACE: 'session:set-workspace',
  SESSION_FORK: 'session:fork',
  SESSION_ARCHIVE: 'session:archive',
  SESSION_SEARCH: 'session:search',
  SESSIONS_SAVE: 'sessions:save',
  SESSIONS_LOAD: 'sessions:load',
  MESSAGES_SAVE: 'messages:save',
  MESSAGES_LOAD: 'messages:load',
  FILE_LIST: 'file:list',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DIALOG: 'file:dialog',
  FILE_ATTACHMENTS_PICK: 'file:attachments-pick',
  SHELL_EXEC: 'shell:exec',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  MEMORY_GET: 'memory:get',
  MEMORY_SET: 'memory:set',
  MEMORY_SEARCH: 'memory:search',
  MEMORY_RECONCILE: 'memory:reconcile',
  COMPACT: 'conversation:compact',
  PERMISSION_REQUEST: 'permission:request',
  PERMISSION_RESPONSE: 'permission:response',
  GIT_INFO: 'git:info',
  TOOLS_LIST: 'tools:list',
  MCP_SERVERS_GET: 'mcp:servers:get',
  MCP_SERVERS_ADD: 'mcp:servers:add',
  MCP_SERVERS_REMOVE: 'mcp:servers:remove',
  MCP_SERVERS_TOGGLE: 'mcp:servers:toggle',
  AUTOMATION_RULES_GET: 'automation:rules:get',
  AUTOMATION_RULES_ADD: 'automation:rules:add',
  AUTOMATION_RULES_REMOVE: 'automation:rules:remove',
  AUTOMATION_RULES_TOGGLE: 'automation:rules:toggle',
  AUTOMATION_RULES_UPDATE: 'automation:rules:update',
  AUTOMATION_EXECUTIONS_GET: 'automation:executions:get',
  AUTOMATION_RUN: 'automation:run',
  TTS_GENERATE: 'tts:generate',
  TTS_SAVE: 'tts:save',
  API_VALIDATE: 'api:validate',
  SKILLS_LIST: 'skills:list',
  SKILLS_MATCH: 'skills:match',
  SKILLS_ACTIVATE: 'skills:activate',
  SYSTEM_GET_INFO: 'system:get-info',
  COLLABORATION_LIST: 'collaboration:list',
  COLLABORATION_UPDATE: 'collaboration:update',
  SUPERVISOR_GET_VIOLATIONS: 'supervisor:get-violations',
  SUPERVISOR_SET_ENABLED: 'supervisor:set-enabled',

  CONSOLE_GET_LOGS: 'console:get-logs',

  TASK_LIST: 'task:list',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',

  TOOL_READ_OUTPUT: 'tool:read-output',
} as const;

const api = {
  // Agent
  agent: {
    run: (prompt: string) => ipcRenderer.invoke(IPC.AGENT_RUN, prompt),
    stop: () => ipcRenderer.send(IPC.AGENT_STOP),
    clear: () => ipcRenderer.invoke(IPC.AGENT_CLEAR),
    onToken: (cb: (token: string) => void) => {
      const handler = (_: unknown, token: string) => cb(token);
      ipcRenderer.on(IPC.AGENT_TOKEN, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_TOKEN, handler);
    },
    onToolStart: (cb: (tool: { name: string; args: Record<string, unknown> }) => void) => {
      const handler = (_: unknown, tool: { name: string; args: Record<string, unknown> }) => cb(tool);
      ipcRenderer.on(IPC.AGENT_TOOL_START, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_TOOL_START, handler);
    },
    onToolResult: (cb: (result: { name: string; output: string; isError: boolean; truncated?: boolean; outputPath?: string }) => void) => {
      const handler = (_: unknown, result: { name: string; output: string; isError: boolean; truncated?: boolean; outputPath?: string }) => cb(result);
      ipcRenderer.on(IPC.AGENT_TOOL_RESULT, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_TOOL_RESULT, handler);
    },
    onDone: (cb: (usage: { tokens: number; cost: number; cachedTokens?: number; promptTokens?: number; completionTokens?: number }) => void) => {
      const handler = (_: unknown, usage: { tokens: number; cost: number; cachedTokens?: number; promptTokens?: number; completionTokens?: number }) => cb(usage);
      ipcRenderer.on(IPC.AGENT_DONE, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_DONE, handler);
    },
    onError: (cb: (error: string) => void) => {
      const handler = (_: unknown, error: string) => cb(error);
      ipcRenderer.on(IPC.AGENT_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_ERROR, handler);
    },
    onThinking: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on(IPC.AGENT_THINKING, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_THINKING, handler);
    },
    onContextPressure: (cb: (data: { level: 0 | 1 | 2 | 3; usable: number; current: number }) => void) => {
      const handler = (_: unknown, data: { level: 0 | 1 | 2 | 3; usable: number; current: number }) => cb(data);
      ipcRenderer.on(IPC.AGENT_CONTEXT_PRESSURE, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_CONTEXT_PRESSURE, handler);
    },
  },

  // Config
  config: {
    get: () => ipcRenderer.invoke(IPC.CONFIG_GET),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC.CONFIG_SET, key, value),
  },

  // Workspace
  workspace: {
    get: () => ipcRenderer.invoke(IPC.WORKSPACE_GET),
    set: (path: string) => ipcRenderer.invoke(IPC.WORKSPACE_SET, path),
    select: () => ipcRenderer.invoke(IPC.WORKSPACE_SELECT),
  },

  // Sessions
  session: {
    list: () => ipcRenderer.invoke(IPC.SESSION_LIST),
    create: (name?: string, workspacePath?: string) => ipcRenderer.invoke(IPC.SESSION_CREATE, name, workspacePath),
    switch: (id: string) => ipcRenderer.invoke(IPC.SESSION_SWITCH, id),
    delete: (id: string) => ipcRenderer.invoke(IPC.SESSION_DELETE, id),
    rename: (id: string, name: string) => ipcRenderer.invoke(IPC.SESSION_RENAME, id, name),
    setWorkspace: (id: string, path: string) => ipcRenderer.invoke(IPC.SESSION_SET_WORKSPACE, id, path),
    fork: (id: string, title: string) => ipcRenderer.invoke(IPC.SESSION_FORK, id, title),
    archive: (id: string) => ipcRenderer.invoke(IPC.SESSION_ARCHIVE, id),
    search: (query: string) => ipcRenderer.invoke(IPC.SESSION_SEARCH, query),
  },

  // Files
  files: {
    list: (path?: string) => ipcRenderer.invoke(IPC.FILE_LIST, path),
    read: (path: string) => ipcRenderer.invoke(IPC.FILE_READ, path),
    write: (path: string, content: string) => ipcRenderer.invoke(IPC.FILE_WRITE, path, content),
    pickAttachments: () => ipcRenderer.invoke(IPC.FILE_ATTACHMENTS_PICK),
  },

  // Window
  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  },

  // Memory
  memory: {
    get: () => ipcRenderer.invoke(IPC.MEMORY_GET),
    set: (content: string) => ipcRenderer.invoke(IPC.MEMORY_SET, content),
    search: (query: string, options?: { scope?: string; limit?: number }) => ipcRenderer.invoke(IPC.MEMORY_SEARCH, query, options),
    reconcile: () => ipcRenderer.invoke(IPC.MEMORY_RECONCILE),
  },

  // Conversation
  conversation: {
    compact: () => ipcRenderer.invoke(IPC.COMPACT),
  },

  // Sessions persistence
  sessions: {
    save: (sessions: unknown[]) => ipcRenderer.invoke(IPC.SESSIONS_SAVE, sessions),
    load: () => ipcRenderer.invoke(IPC.SESSIONS_LOAD),
  },

  // Messages persistence
  messages: {
    save: (sessionId: string, data: unknown) => ipcRenderer.invoke(IPC.MESSAGES_SAVE, sessionId, data),
    load: (sessionId: string) => ipcRenderer.invoke(IPC.MESSAGES_LOAD, sessionId),
  },

  // Git
  git: {
    info: () => ipcRenderer.invoke(IPC.GIT_INFO),
  },

  // Tools
  tools: {
    list: () => ipcRenderer.invoke(IPC.TOOLS_LIST),
  },

  // MCP Servers
  mcp: {
    getServers: () => ipcRenderer.invoke(IPC.MCP_SERVERS_GET),
    addServer: (server: { name: string; command: string; args: string[]; env?: Record<string, string> }) =>
      ipcRenderer.invoke(IPC.MCP_SERVERS_ADD, server),
    removeServer: (id: string) => ipcRenderer.invoke(IPC.MCP_SERVERS_REMOVE, id),
    toggleServer: (id: string, enabled: boolean) => ipcRenderer.invoke(IPC.MCP_SERVERS_TOGGLE, id, enabled),
  },

  // Automation
  automation: {
    getRules: () => ipcRenderer.invoke(IPC.AUTOMATION_RULES_GET),
    addRule: (rule: { name: string; trigger: { type: string; config: Record<string, unknown> }; action: { type: string; config: Record<string, unknown> } }) =>
      ipcRenderer.invoke(IPC.AUTOMATION_RULES_ADD, rule),
    removeRule: (id: string) => ipcRenderer.invoke(IPC.AUTOMATION_RULES_REMOVE, id),
    toggleRule: (id: string, enabled: boolean) => ipcRenderer.invoke(IPC.AUTOMATION_RULES_TOGGLE, id, enabled),
    updateRule: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke(IPC.AUTOMATION_RULES_UPDATE, id, updates),
    getExecutions: () => ipcRenderer.invoke(IPC.AUTOMATION_EXECUTIONS_GET),
    runRule: (id: string) => ipcRenderer.invoke(IPC.AUTOMATION_RUN, id),
  },

  // TTS
  tts: {
    generate: (params: { text: string; model: string; voice?: string; speed?: number; thinkingIntensity?: string }) => ipcRenderer.invoke(IPC.TTS_GENERATE, params),
    save: (audioId: string) => ipcRenderer.invoke(IPC.TTS_SAVE, audioId),
  },

  // API
  api: {
    validate: () => ipcRenderer.invoke(IPC.API_VALIDATE),
  },

  // Skills
  skills: {
    list: () => ipcRenderer.invoke(IPC.SKILLS_LIST),
    match: (input: string) => ipcRenderer.invoke(IPC.SKILLS_MATCH, input),
    activate: (skillId: string) => ipcRenderer.invoke(IPC.SKILLS_ACTIVATE, skillId),
  },

  // System
  system: {
    getInfo: () => ipcRenderer.invoke(IPC.SYSTEM_GET_INFO),
  },

  // Collaboration
  collaboration: {
    list: () => ipcRenderer.invoke(IPC.COLLABORATION_LIST),
    onUpdate: (cb: (task: unknown) => void) => {
      const handler = (_: unknown, task: unknown) => cb(task);
      ipcRenderer.on(IPC.COLLABORATION_UPDATE, handler);
      return () => ipcRenderer.removeListener(IPC.COLLABORATION_UPDATE, handler);
    },
  },

  // Supervisor
  supervisor: {
    getViolations: () => ipcRenderer.invoke(IPC.SUPERVISOR_GET_VIOLATIONS),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IPC.SUPERVISOR_SET_ENABLED, enabled),
  },

  // Console
  console: {
    getLogs: () => ipcRenderer.invoke(IPC.CONSOLE_GET_LOGS),
  },

  // Task Management
  tasks: {
    list: (sessionId?: string, statusFilter?: string) => ipcRenderer.invoke(IPC.TASK_LIST, sessionId, statusFilter),
    create: (summary: string, parentId?: string, sessionId?: string) => ipcRenderer.invoke(IPC.TASK_CREATE, summary, parentId, sessionId),
    update: (taskId: string, updates: Record<string, unknown>, sessionId?: string) => ipcRenderer.invoke(IPC.TASK_UPDATE, taskId, updates, sessionId),
  },

  // Tool output reading (for truncated outputs saved to disk)
  tool: {
    readOutput: (filePath: string) => ipcRenderer.invoke(IPC.TOOL_READ_OUTPUT, filePath),
  },

  // Generic event listeners
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const handler = (_: unknown, ...args: unknown[]) => cb(_, ...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  off: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, cb as (...args: unknown[]) => void);
  },

  // Permission
  permission: {
    request: (params: { toolName: string; description: string; riskLevel: string }) =>
      ipcRenderer.invoke(IPC.PERMISSION_REQUEST, params),
    onResponse: (cb: (response: { requestId: string; allowed: boolean }) => void) => {
      const handler = (_: unknown, response: { requestId: string; allowed: boolean }) => cb(response);
      ipcRenderer.on(IPC.PERMISSION_RESPONSE, handler);
      return () => ipcRenderer.removeListener(IPC.PERMISSION_RESPONSE, handler);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type MimoAPI = typeof api;
