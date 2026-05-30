import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { IPC } from '../shared/ipc-channels.js';
import type { AppConfig, AutomationExecution, AutomationRule, FileTreeNode, McpServerConfig, PublicAppConfig, Session, ToolInfo, WorkspaceInfo } from '../shared/types.js';
import { AgentService } from './agent-service.js';
import { ttsAudioStore } from './tts-store.js';

const SESSIONS_FILE = join(app.getPath('userData'), 'sessions.json');
const MCP_SERVERS_FILE = join(app.getPath('userData'), 'mcp-servers.json');
const AUTOMATION_RULES_FILE = join(app.getPath('userData'), 'automation-rules.json');
const AUTOMATION_EXECUTIONS_FILE = join(app.getPath('userData'), 'automation-executions.json');

const configKeys = new Set<keyof AppConfig>([
  'model',
  'apiBase',
  'apiKey',
  'permissionMode',
  'maxTurns',
  'temperature',
  'theme',
  'selectedAvatarId',
  'sandboxEnabled',
]);

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'release', 'out', 'build', '.next', '.vite']);
const maxFilePreviewBytes = 512 * 1024;
const maxFileTreeDepth = 3;
const maxFileTreeEntries = 600;
const maxEntriesPerDirectory = 120;

function isConfigKey(key: string): key is keyof AppConfig {
  return configKeys.has(key as keyof AppConfig);
}

function validateConfigValue(key: keyof AppConfig, value: unknown): AppConfig[keyof AppConfig] {
  switch (key) {
    case 'model':
    case 'apiKey':
    case 'selectedAvatarId':
      if (typeof value !== 'string') throw new Error(`${key} must be a string`);
      return value;
    case 'apiBase':
      if (typeof value !== 'string') throw new Error('apiBase must be a string');
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('apiBase must be an HTTP(S) URL');
      } catch {
        throw new Error('apiBase must be a valid URL');
      }
      return value;
    case 'permissionMode':
      if (value !== 'suggest' && value !== 'auto-edit' && value !== 'full-auto') throw new Error('permissionMode is invalid');
      return value;
    case 'maxTurns':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 200) {
        throw new Error('maxTurns must be an integer between 1 and 200');
      }
      return value;
    case 'temperature':
      if (typeof value !== 'number' || value < 0 || value > 2) throw new Error('temperature must be between 0 and 2');
      return value;
    case 'theme':
      if (value !== 'dark' && value !== 'light') throw new Error('theme is invalid');
      return value;
    case 'sandboxEnabled':
      if (typeof value !== 'boolean') throw new Error('sandboxEnabled must be a boolean');
      return value;
  }
}

function maskApiKey(apiKey: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return '********';
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
}

function getPublicConfig(): PublicAppConfig {
  const { apiKey, ...publicConfig } = currentConfig;
  return {
    ...publicConfig,
    apiKeyConfigured: apiKey.length > 0,
    apiKeyPreview: maskApiKey(apiKey),
  };
}

function getWorkspaceInfo(): WorkspaceInfo {
  const ws = getCurrentWorkspace();
  return {
    path: ws,
    name: basename(ws) || ws,
  };
}

function resolveWorkspacePath(targetPath: string): string {
  return resolve(isAbsolute(targetPath) ? targetPath : join(getCurrentWorkspace(), targetPath));
}

function ensureInsideWorkspace(targetPath: string): string {
  const absolute = resolveWorkspacePath(targetPath);
  const root = resolve(getCurrentWorkspace());
  const rel = relative(root, absolute);
  if (rel && (rel.startsWith('..') || isAbsolute(rel))) {
    throw new Error('Path is outside the active workspace');
  }
  return absolute;
}

function setWorkspace(path: string): WorkspaceInfo {
  const absolute = resolve(path);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) {
    throw new Error('Workspace path must be an existing directory');
  }
  const session = getActiveSession();
  if (session) {
    session.workspacePath = absolute;
    session.workspaceName = basename(absolute);
    session.updatedAt = new Date().toISOString();
  }
  return { path: absolute, name: basename(absolute) };
}

function listFiles(basePath: string | undefined, depth = 0, seen = { count: 0 }): FileTreeNode[] {
  const absoluteBase = basePath ? ensureInsideWorkspace(basePath) : resolve(getCurrentWorkspace());
  if (depth > maxFileTreeDepth || seen.count >= maxFileTreeEntries) return [];

  let entries;
  try {
    entries = readdirSync(absoluteBase, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileTreeNode[] = [];
  for (const entry of entries
    .filter((entry) => !entry.name.startsWith('.') || entry.name === '.env.example')
    .filter((entry) => !(entry.isDirectory() && ignoredDirs.has(entry.name)))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    .slice(0, maxEntriesPerDirectory)) {
    if (seen.count >= maxFileTreeEntries) break;
    seen.count += 1;

    const absolute = join(absoluteBase, entry.name);
    const node: FileTreeNode = {
      name: entry.name,
      path: absolute,
      type: entry.isDirectory() ? 'directory' : 'file',
    };

    if (entry.isDirectory() && depth < maxFileTreeDepth) {
      node.children = listFiles(absolute as string, depth + 1, seen);
    }

    nodes.push(node);
  }

  return nodes;
}

function readWorkspaceFile(path: string): string {
  const absolute = ensureInsideWorkspace(path);
  const stats = statSync(absolute);
  if (!stats.isFile()) throw new Error('Path is not a file');
  if (stats.size > maxFilePreviewBytes) throw new Error('File is too large to preview');
  return readFileSync(absolute, 'utf8');
}

function writeWorkspaceFile(path: string, content: string): void {
  const absolute = ensureInsideWorkspace(path);
  const dir = join(absolute, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

function getDefaultWorkspace(): string {
  const candidates = [process.cwd(), app.getAppPath(), app.getPath('home')];
  for (const candidate of candidates) {
    try {
      const absolute = resolve(candidate);
      if (existsSync(absolute) && statSync(absolute).isDirectory()) return absolute;
    } catch {
      // Try the next known Electron-safe location.
    }
  }
  return resolve('.');
}

const defaultConfig: AppConfig = {
  model: 'mimo-v2.5-pro',
  apiBase: process.env.MIMO_API_BASE || 'https://token-plan-cn.xiaomimimo.com/v1',
  apiKey: process.env.MIMO_API_KEY || '',
  permissionMode: 'suggest',
  maxTurns: 50,
  temperature: 0.2,
  theme: 'dark',
  selectedAvatarId: 'default',
  sandboxEnabled: false,
};

let currentConfig: AppConfig = { ...defaultConfig };
let activeSessionId = 'default';
const sessions: Session[] = [
  {
    id: 'default',
    name: '新对话',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    workspacePath: '',
    workspaceName: '',
  },
];
const agentService = new AgentService();

function getActiveSession(): Session | undefined {
  return sessions.find((s) => s.id === activeSessionId);
}

function getCurrentWorkspace(): string {
  const session = getActiveSession();
  return session?.workspacePath || getDefaultWorkspace();
}

// Debounce agent reinitialization to avoid multiple rapid re-inits when batch-setting config
let initDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedInit() {
  if (initDebounceTimer) clearTimeout(initDebounceTimer);
  initDebounceTimer = setTimeout(() => {
    initDebounceTimer = null;
    agentService.initialize({ ...currentConfig }).catch(console.error);
  }, 200);
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  agentService.setMainWindow(mainWindow);

  [
    IPC.CONFIG_GET,
    IPC.CONFIG_SET,
    IPC.WORKSPACE_GET,
    IPC.WORKSPACE_SET,
    IPC.WORKSPACE_SELECT,
    IPC.SESSION_LIST,
    IPC.SESSION_CREATE,
    IPC.SESSION_SWITCH,
    IPC.SESSION_DELETE,
    IPC.SESSION_RENAME,
    IPC.SESSION_SET_WORKSPACE,
    IPC.FILE_DIALOG,
    IPC.FILE_LIST,
    IPC.FILE_READ,
    IPC.FILE_WRITE,
    IPC.AGENT_RUN,
    IPC.AGENT_CLEAR,
    IPC.MEMORY_GET,
    IPC.MEMORY_SET,
    IPC.COMPACT,
    IPC.SESSIONS_SAVE,
    IPC.SESSIONS_LOAD,
    IPC.GIT_INFO,
    IPC.TTS_GENERATE,
    IPC.TTS_SAVE,
  ].forEach((channel) => ipcMain.removeHandler(channel));

  [IPC.WINDOW_MINIMIZE, IPC.WINDOW_MAXIMIZE, IPC.WINDOW_CLOSE, IPC.AGENT_STOP].forEach((channel) => {
    ipcMain.removeAllListeners(channel);
  });

  ipcMain.handle(IPC.CONFIG_GET, () => getPublicConfig());
  ipcMain.handle(IPC.CONFIG_SET, (_, key: string, value: unknown) => {
    if (!isConfigKey(key)) throw new Error(`Unknown config key: ${key}`);
    (currentConfig as unknown as Record<string, unknown>)[key] = validateConfigValue(key, value);

    if (['apiKey', 'apiBase', 'model', 'permissionMode', 'maxTurns', 'temperature', 'sandboxEnabled'].includes(key)) {
      debouncedInit();
    }

    return getPublicConfig();
  });

  ipcMain.handle(IPC.WORKSPACE_GET, () => getWorkspaceInfo());
  ipcMain.handle(IPC.WORKSPACE_SET, (_, path: string) => setWorkspace(path));
  ipcMain.handle(IPC.WORKSPACE_SELECT, async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : setWorkspace(result.filePaths[0]);
  });

  ipcMain.handle(IPC.SESSION_LIST, () => sessions);
  ipcMain.handle(IPC.SESSION_CREATE, (_, name?: string, workspacePath?: string) => {
    const ws = workspacePath ? resolve(workspacePath) : '';
    const session: Session = {
      id: Date.now().toString(36),
      name: name || `对话 ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      workspacePath: ws,
      workspaceName: ws ? basename(ws) : '',
    };
    sessions.push(session);
    return session;
  });
  ipcMain.handle(IPC.SESSION_SWITCH, (_, id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      activeSessionId = id;
    }
  });
  ipcMain.handle(IPC.SESSION_DELETE, (_, id: string) => {
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx > 0) sessions.splice(idx, 1);
  });
  ipcMain.handle(IPC.SESSION_RENAME, (_, id: string, name: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) session.name = name;
  });
  ipcMain.handle(IPC.SESSION_SET_WORKSPACE, (_, id: string, path: string) => {
    const workspace = setWorkspace(path);
    const session = sessions.find((s) => s.id === id);
    if (!session) throw new Error('Session not found');
    session.workspacePath = workspace.path;
    session.workspaceName = workspace.name;
    session.updatedAt = new Date().toISOString();
    return session;
  });

  ipcMain.handle(IPC.FILE_DIALOG, async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle(IPC.FILE_LIST, (_, path?: string) => listFiles(path));
  ipcMain.handle(IPC.FILE_READ, (_, path: string) => readWorkspaceFile(path));
  ipcMain.handle(IPC.FILE_WRITE, (_, path: string, content: string) => {
    writeWorkspaceFile(path, content);
    return { success: true };
  });

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow.minimize());
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow.close());

  ipcMain.handle(IPC.AGENT_RUN, async (_, prompt: string) => {
    try {
      const ws = getCurrentWorkspace();
      if (currentConfig.apiKey) await agentService.initialize({ ...currentConfig }, ws);
      await agentService.run(prompt, ws);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[IPC] Agent error:', message);
      mainWindow.webContents.send(IPC.AGENT_ERROR, message);
    }
  });

  ipcMain.on(IPC.AGENT_STOP, () => {
    agentService.stop();
  });

  ipcMain.handle(IPC.AGENT_CLEAR, () => {
    agentService.clear();
  });

  ipcMain.handle(IPC.MEMORY_GET, async () => {
    try {
      const agent = agentService.getAgent?.();
      const memory = agent?.getMemory?.();
      return { content: memory?.getContent?.() || '' };
    } catch { return { content: '' }; }
  });

  ipcMain.handle(IPC.MEMORY_SET, async (_event, content: string) => {
    try {
      const agent = agentService.getAgent?.();
      const memory = agent?.getMemory?.();
      memory?.setContent?.(content);
      await memory?.save?.();
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle(IPC.COMPACT, async () => {
    try {
      const agent = agentService.getAgent?.();
      if (!agent) return { success: false, error: 'Agent not initialized' };
      const conversation = agent.getConversation();
      const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
      const compactionPath = join(appRoot, 'engine', 'dist', 'context', 'compaction.js');
      const compactionUrl = pathToFileURL(compactionPath).href;
      const { compactMessages, shouldCompact } = await eval(`import('${compactionUrl}')`);
      if (shouldCompact(conversation)) {
        const compacted = compactMessages(conversation);
        agent.setConversation(compacted);
        return { success: true, messageCount: compacted.length };
      }
      return { success: true, messageCount: conversation.length, compacted: false };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle(IPC.SESSIONS_SAVE, async (_event, sessionsData: Session[]) => {
    try {
      const dir = join(SESSIONS_FILE, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle(IPC.SESSIONS_LOAD, async () => {
    try {
      if (!existsSync(SESSIONS_FILE)) return { sessions: [] };
      const data = readFileSync(SESSIONS_FILE, 'utf-8');
      return { sessions: JSON.parse(data) };
    } catch { return { sessions: [] }; }
  });

  ipcMain.handle(IPC.GIT_INFO, () => {
    const workspace = getCurrentWorkspace();
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspace,
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();

      const statusOutput = execSync('git status --porcelain', {
        cwd: workspace,
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();

      const changedFiles = statusOutput ? statusOutput.split('\n').filter(Boolean).length : 0;

      return { branch, changedFiles };
    } catch {
      return { branch: '', changedFiles: 0 };
    }
  });

  // === Tools ===
  ipcMain.handle(IPC.TOOLS_LIST, async () => {
    try {
      const agent = agentService.getAgent();
      if (!agent) return [];
      const registry = (agent as any).toolRegistry;
      if (!registry) return [];
      const tools = registry.getAll ? registry.getAll() : [];
      return tools.map((t: any): ToolInfo => ({
        name: t.name,
        description: t.description || '',
        riskLevel: t.riskLevel || 'safe',
        categories: t.categories || [],
        parameterCount: t.parameters?.function?.parameters?.properties ? Object.keys(t.parameters.function.parameters.properties).length : 0,
      }));
    } catch { return []; }
  });

  // === MCP Servers ===
  function loadMcpServers(): McpServerConfig[] {
    try {
      if (!existsSync(MCP_SERVERS_FILE)) return [];
      return JSON.parse(readFileSync(MCP_SERVERS_FILE, 'utf-8'));
    } catch { return []; }
  }

  function saveMcpServers(servers: McpServerConfig[]) {
    writeFileSync(MCP_SERVERS_FILE, JSON.stringify(servers, null, 2));
  }

  ipcMain.handle(IPC.MCP_SERVERS_GET, async () => loadMcpServers());

  ipcMain.handle(IPC.MCP_SERVERS_ADD, async (_event, server: Omit<McpServerConfig, 'id' | 'enabled'>) => {
    const servers = loadMcpServers();
    const newServer: McpServerConfig = { ...server, id: Date.now().toString(36), enabled: true };
    servers.push(newServer);
    saveMcpServers(servers);
    return newServer;
  });

  ipcMain.handle(IPC.MCP_SERVERS_REMOVE, async (_event, id: string) => {
    const servers = loadMcpServers().filter(s => s.id !== id);
    saveMcpServers(servers);
    return { success: true };
  });

  ipcMain.handle(IPC.MCP_SERVERS_TOGGLE, async (_event, id: string, enabled: boolean) => {
    const servers = loadMcpServers().map(s => s.id === id ? { ...s, enabled } : s);
    saveMcpServers(servers);
    return { success: true };
  });

  // === Automation ===
  function loadAutomationRules(): AutomationRule[] {
    try {
      if (!existsSync(AUTOMATION_RULES_FILE)) return getDefaultAutomationRules();
      return JSON.parse(readFileSync(AUTOMATION_RULES_FILE, 'utf-8'));
    } catch { return getDefaultAutomationRules(); }
  }

  function getDefaultAutomationRules(): AutomationRule[] {
    return [
      {
        id: 'code-review',
        name: '代码审查',
        enabled: false,
        trigger: { type: 'manual', config: {} },
        action: { type: 'run-prompt', config: { prompt: '请审查当前 git diff 的代码变更，指出潜在问题和改进建议。' } },
      },
      {
        id: 'auto-test',
        name: '自动测试',
        enabled: false,
        trigger: { type: 'manual', config: {} },
        action: { type: 'run-prompt', config: { prompt: '请运行项目的测试套件并报告结果。' } },
      },
      {
        id: 'commit-check',
        name: '提交规范',
        enabled: false,
        trigger: { type: 'manual', config: {} },
        action: { type: 'run-prompt', config: { prompt: '请检查最近的 git commit message 是否符合 Conventional Commits 规范。' } },
      },
      {
        id: 'dep-check',
        name: '依赖检查',
        enabled: false,
        trigger: { type: 'manual', config: {} },
        action: { type: 'run-prompt', config: { prompt: '请检查项目中是否有过时或有安全漏洞的依赖。' } },
      },
    ];
  }

  function saveAutomationRules(rules: AutomationRule[]) {
    writeFileSync(AUTOMATION_RULES_FILE, JSON.stringify(rules, null, 2));
  }

  function loadExecutions(): AutomationExecution[] {
    try {
      if (!existsSync(AUTOMATION_EXECUTIONS_FILE)) return [];
      return JSON.parse(readFileSync(AUTOMATION_EXECUTIONS_FILE, 'utf-8'));
    } catch { return []; }
  }

  function saveExecution(exec: AutomationExecution) {
    const executions = loadExecutions();
    executions.unshift(exec);
    if (executions.length > 50) executions.length = 50;
    writeFileSync(AUTOMATION_EXECUTIONS_FILE, JSON.stringify(executions, null, 2));
  }

  ipcMain.handle(IPC.AUTOMATION_RULES_GET, async () => loadAutomationRules());

  ipcMain.handle(IPC.AUTOMATION_RULES_ADD, async (_event, rule: Omit<AutomationRule, 'id'>) => {
    const rules = loadAutomationRules();
    const newRule: AutomationRule = { ...rule, id: Date.now().toString(36) };
    rules.push(newRule);
    saveAutomationRules(rules);
    return newRule;
  });

  ipcMain.handle(IPC.AUTOMATION_RULES_REMOVE, async (_event, id: string) => {
    const rules = loadAutomationRules().filter(r => r.id !== id);
    saveAutomationRules(rules);
    return { success: true };
  });

  ipcMain.handle(IPC.AUTOMATION_RULES_TOGGLE, async (_event, id: string, enabled: boolean) => {
    const rules = loadAutomationRules().map(r => r.id === id ? { ...r, enabled } : r);
    saveAutomationRules(rules);
    return { success: true };
  });

  ipcMain.handle(IPC.AUTOMATION_RULES_UPDATE, async (_event, id: string, updates: Partial<AutomationRule>) => {
    const rules = loadAutomationRules().map(r => r.id === id ? { ...r, ...updates } : r);
    saveAutomationRules(rules);
    return { success: true };
  });

  ipcMain.handle(IPC.AUTOMATION_EXECUTIONS_GET, async () => loadExecutions());

  ipcMain.handle(IPC.AUTOMATION_RUN, async (_event, id: string) => {
    const rules = loadAutomationRules();
    const rule = rules.find(r => r.id === id);
    if (!rule) return { success: false, error: '规则不存在' };

    const startTime = Date.now();
    try {
      if (rule.action.type === 'run-prompt') {
        const prompt = (rule.action.config as any).prompt;
        await agentService.run(prompt);
        const exec: AutomationExecution = {
          id: Date.now().toString(36),
          ruleId: rule.id,
          ruleName: rule.name,
          timestamp: Date.now(),
          success: true,
          duration: Date.now() - startTime,
        };
        saveExecution(exec);
        return { success: true };
      }
      if (rule.action.type === 'run-tool') {
        const config = rule.action.config as any;
        const command = config.command || config.args?.command;
        if (!command) throw new Error('缺少执行命令');
        const output = execSync(command, { timeout: 30000, encoding: 'utf-8', cwd: getCurrentWorkspace() });
        const exec: AutomationExecution = {
          id: Date.now().toString(36),
          ruleId: rule.id,
          ruleName: rule.name,
          timestamp: Date.now(),
          success: true,
          output: output.slice(0, 1000),
          duration: Date.now() - startTime,
        };
        saveExecution(exec);
        return { success: true, output };
      }
      return { success: false, error: '不支持的动作类型' };
    } catch (e) {
      const exec: AutomationExecution = {
        id: Date.now().toString(36),
        ruleId: rule.id,
        ruleName: rule.name,
        timestamp: Date.now(),
        success: false,
        output: String(e),
        duration: Date.now() - startTime,
      };
      saveExecution(exec);
      return { success: false, error: String(e) };
    }
  });

  // === TTS (via Chat Completions with audio modality) ===
  ipcMain.handle(IPC.TTS_GENERATE, async (_event, params: { text: string; model: string; voice?: string; speed?: number; thinkingIntensity?: string }) => {
    try {
      const { text, model, voice, speed, thinkingIntensity } = params;
      if (!text?.trim()) return { success: false, error: '请输入要转换的文本' };

      const apiBase = currentConfig.apiBase;
      const apiKey = currentConfig.apiKey;
      if (!apiKey) return { success: false, error: '请先在设置中配置 API Key' };

      const chatBase = apiBase.replace(/\/v1\/?$/, '') + '/v1';

      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'user', content: '请朗读以下内容' },
          { role: 'assistant', content: text },
        ],
        modalities: ['text', 'audio'],
        audio: {
          voice: voice || 'mimo_default',
          format: 'wav',
        },
      };
      if (thinkingIntensity) {
        body.thinking_intensity = thinkingIntensity;
      }

      const response = await fetch(`${chatBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, error: `TTS 请求失败 (${response.status}): ${errorText || response.statusText}` };
      }

      const json = await response.json() as {
        choices?: Array<{ message?: { audio?: { data?: string } } }>;
      };
      const audioData = json.choices?.[0]?.message?.audio?.data;
      if (!audioData) {
        return { success: false, error: '未返回音频数据，请检查模型是否支持 TTS' };
      }

      // Store audio buffer and return custom protocol URL
      const id = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const wavBuf = Buffer.from(audioData, 'base64');
      ttsAudioStore.set(id, wavBuf);
      return { success: true, audioUrl: `tts-audio://${id}`, audioId: id };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });

  ipcMain.handle('tts:save', async (_event, audioId: string) => {
    const buf = ttsAudioStore.get(audioId);
    if (!buf) return { success: false, error: '音频数据不存在' };
    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: '保存语音文件',
      defaultPath: `tts-${Date.now()}.wav`,
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
    });
    if (!filePath) return { success: false, error: '已取消' };
    writeFileSync(filePath, buf);
    return { success: true, filePath };
  });
}
