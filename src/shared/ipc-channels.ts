export const IPC = {
  AGENT_RUN: 'agent:run',
  AGENT_STOP: 'agent:stop',
  AGENT_CLEAR: 'agent:clear',
  AGENT_TOKEN: 'agent:token',
  AGENT_TOOL_START: 'agent:tool-start',
  AGENT_TOOL_RESULT: 'agent:tool-result',
  AGENT_DONE: 'agent:done',
  AGENT_ERROR: 'agent:error',
  AGENT_THINKING: 'agent:thinking',

  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_SET: 'workspace:set',
  WORKSPACE_SELECT: 'workspace:select',

  SESSION_LIST: 'session:list',
  SESSION_CREATE: 'session:create',
  SESSION_SWITCH: 'session:switch',
  SESSION_DELETE: 'session:delete',
  SESSION_RENAME: 'session:rename',
  SESSION_SET_WORKSPACE: 'session:set-workspace',
  SESSIONS_SAVE: 'sessions:save',
  SESSIONS_LOAD: 'sessions:load',
  MESSAGES_SAVE: 'messages:save',
  MESSAGES_LOAD: 'messages:load',

  FILE_LIST: 'file:list',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DIALOG: 'file:dialog',

  SHELL_EXEC: 'shell:exec',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  MEMORY_GET: 'memory:get',
  MEMORY_SET: 'memory:set',
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
} as const;
