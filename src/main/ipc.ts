import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { exec, execSync } from 'child_process';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { IPC } from '../shared/ipc-channels.js';
import type { AppConfig, AutomationExecution, AutomationRule, CollaborationTask, FileTreeNode, McpServerConfig, PublicAppConfig, Session, ToolInfo, WorkspaceInfo } from '../shared/types.js';
import { AgentService } from './agent-service.js';
import { runRules } from './supervisor-rules.js';
import type { Violation } from './supervisor-rules.js';
import { ttsAudioStore } from './tts-store.js';

// Module-level ref to the main window, set once registerIpcHandlers is called
let mainWindowRef: BrowserWindow | null = null;

// Module-level ref for supervisor check function, set inside registerIpcHandlers
let supervisorCheckToolOutput: ((toolName: string, output: string, filePath?: string) => void) | null = null;

const logBuffer: Array<{timestamp: number; level: string; message: string; source?: string}> = [];
const MAX_LOG_BUFFER = 200;

// Collaboration task tracking
const collaborationTasks: CollaborationTask[] = [];
const MAX_COLLABORATION_TASKS = 50;


function sendLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, source?: string) {
  logBuffer.push({ timestamp: Date.now(), level, message, source });
  if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(IPC.LOG_ENTRY, {
      timestamp: Date.now(),
      level,
      message,
      source,
    });
  }
}

const SESSIONS_FILE = join(app.getPath('userData'), 'sessions.json');
const MCP_SERVERS_FILE = join(app.getPath('userData'), 'mcp-servers.json');
const AUTOMATION_RULES_FILE = join(app.getPath('userData'), 'automation-rules.json');
const AUTOMATION_EXECUTIONS_FILE = join(app.getPath('userData'), 'automation-executions.json');
const CONFIG_FILE = join(app.getPath('userData'), 'config.json');

/** Generate a unique ID with timestamp + random suffix to avoid collisions */
function generateId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

const configKeys = new Set<keyof AppConfig>([
  'model',
  'apiBase',
  'apiKey',
  'permissionMode',
  'toolPreset',
  'maxTurns',
  'temperature',
  'reasoningEffort',
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
    case 'toolPreset':
      if (value !== 'plan' && value !== 'act') throw new Error('toolPreset must be plan or act');
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
    case 'reasoningEffort':
      if (value !== 'low' && value !== 'medium' && value !== 'high') throw new Error('reasoningEffort must be low, medium, or high');
      return value;
    default:
      throw new Error(`Unknown config key: ${key}`);
  }
}

function loadConfig(): Partial<AppConfig> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Config] Failed to load config:', err);
  }
  return {};
}

function saveConfig(config: AppConfig): void {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Config] Failed to save config:', err);
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

  // Normalize both paths for consistent comparison
  const normalizedAbsolute = absolute.replace(/\\/g, '/').toLowerCase();
  const normalizedRoot = root.replace(/\\/g, '/').toLowerCase();

  // Check if the absolute path starts with the root path
  if (!normalizedAbsolute.startsWith(normalizedRoot + '/') && normalizedAbsolute !== normalizedRoot) {
    throw new Error('Path is outside the active workspace');
  }

  // Additional check using relative() for edge cases
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
  // Invalidate cache when workspace changes
  invalidateFileTreeCache();
  return { path: absolute, name: basename(absolute) };
}

// File tree cache with TTL and mtime-based invalidation
interface FileTreeCacheEntry {
  nodes: FileTreeNode[];
  timestamp: number;
  dirMTimes: Map<string, number>;
}

const fileTreeCache = new Map<string, FileTreeCacheEntry>();
const FILE_TREE_TTL_MS = 5000; // 5 seconds

function isCacheValid(entry: FileTreeCacheEntry, rootPath: string): boolean {
  // TTL gate
  if (Date.now() - entry.timestamp > FILE_TREE_TTL_MS) return false;
  // mtime gate - only stat the root directory
  try {
    const currentMtime = statSync(rootPath).mtimeMs;
    const cachedMtime = entry.dirMTimes.get(rootPath);
    return currentMtime === cachedMtime;
  } catch {
    return false; // directory gone, cache invalid
  }
}

function invalidateFileTreeCache(workspacePath?: string): void {
  if (workspacePath) {
    fileTreeCache.delete(resolve(workspacePath));
  } else {
    fileTreeCache.clear();
  }
}

async function listFiles(basePath: string | undefined, depth = 0, seen = { count: 0 }): Promise<FileTreeNode[]> {
  const absoluteBase = basePath ? ensureInsideWorkspace(basePath) : resolve(getCurrentWorkspace());

  // Only cache root-level calls (depth === 0, no explicit basePath)
  const isRootCall = depth === 0 && !basePath;
  if (isRootCall) {
    const cached = fileTreeCache.get(absoluteBase);
    if (cached && isCacheValid(cached, absoluteBase)) {
      return cached.nodes;
    }
  }

  if (depth > maxFileTreeDepth || seen.count >= maxFileTreeEntries) return [];

  let entries;
  try {
    entries = await readdir(absoluteBase, { withFileTypes: true });
  } catch (err) {
    console.warn('[listFiles] Failed to read directory:', absoluteBase, err);
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
      node.children = await listFiles(absolute as string, depth + 1, seen);
    }

    nodes.push(node);
  }

  // Cache the result for root-level calls
  if (isRootCall) {
    const dirMTimes = new Map<string, number>();
    try {
      dirMTimes.set(absoluteBase, statSync(absoluteBase).mtimeMs);
    } catch { /* ignore */ }
    fileTreeCache.set(absoluteBase, {
      nodes,
      timestamp: Date.now(),
      dirMTimes,
    });
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
  // Invalidate cache - the written file may be new
  invalidateFileTreeCache(getCurrentWorkspace());
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

function createDefaultSession(): Session {
  const now = new Date().toISOString();
  return {
    id: 'default',
    name: '新对话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    workspacePath: '',
    workspaceName: '',
  };
}

function normalizeSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return [createDefaultSession()];
  const normalized = value
    .filter((session): session is Partial<Session> => typeof session === 'object' && session !== null)
    .filter((session) => typeof session.id === 'string' && typeof session.name === 'string')
    .map((session) => ({
      id: session.id as string,
      name: session.name as string,
      createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString(),
      updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString(),
      messageCount: typeof session.messageCount === 'number' ? session.messageCount : 0,
      workspacePath: typeof session.workspacePath === 'string' ? session.workspacePath : '',
      workspaceName: typeof session.workspaceName === 'string' ? session.workspaceName : '',
    }));
  if (normalized.length === 0) return [createDefaultSession()];
  if (!normalized.some((session) => session.id === 'default')) {
    return [createDefaultSession(), ...normalized];
  }
  return normalized;
}

function loadSessionsFromDisk(): Session[] {
  try {
    if (!existsSync(SESSIONS_FILE)) return [createDefaultSession()];
    const data = readFileSync(SESSIONS_FILE, 'utf-8');
    return normalizeSessions(JSON.parse(data));
  } catch (err) {
    console.warn('[SESSIONS_LOAD] Failed to load sessions:', err);
    return [createDefaultSession()];
  }
}

function saveSessionsToDisk(sessionsData: Session[]): { success: boolean; error?: string } {
  try {
    const dir = join(SESSIONS_FILE, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

const defaultConfig: AppConfig = {
  model: 'mimo-v2.5-pro',
  apiBase: process.env.MIMO_API_BASE || 'https://api.xiaomimimo.com/v1',
  apiKey: process.env.MIMO_API_KEY || '',
  permissionMode: 'suggest',
  toolPreset: 'act',
  maxTurns: 50,
  temperature: 0.2,
  reasoningEffort: 'medium',
  theme: 'dark',
  selectedAvatarId: 'default',
  sandboxEnabled: false,
};

// Load saved config from disk and merge with defaults
const savedConfig = loadConfig();
const currentConfig: AppConfig = { ...defaultConfig, ...savedConfig };
let sessions: Session[] = loadSessionsFromDisk();
let activeSessionId = sessions[0]?.id || 'default';
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

// Collaboration task management
export function addCollaborationTask(task: CollaborationTask): void {
  collaborationTasks.push(task);
  if (collaborationTasks.length > MAX_COLLABORATION_TASKS) collaborationTasks.shift();
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(IPC.COLLABORATION_UPDATE, task);
  }
}

export function updateCollaborationTask(id: string, updates: Partial<CollaborationTask>): void {
  const task = collaborationTasks.find(t => t.id === id);
  if (task) {
    Object.assign(task, updates);
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send(IPC.COLLABORATION_UPDATE, task);
    }
  }
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
  agentService.setMainWindow(mainWindow);

  // Wire up collaboration event tracking from agent-service
  agentService.setCollaborationCallback((event, task) => {
    if (event === 'add') {
      addCollaborationTask(task);
    } else if (event === 'update' && task.id === '__complete_all__') {
      // Special signal: mark all running tasks with the given status
      for (const t of collaborationTasks) {
        if (t.status === 'running') {
          Object.assign(t, {
            status: task.status,
            endTime: task.endTime,
            result: task.result,
            error: task.error,
          });
          if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            mainWindowRef.webContents.send(IPC.COLLABORATION_UPDATE, t);
          }
        }
      }
    } else {
      updateCollaborationTask(task.id, task);
    }
  });

  // Override global console methods to also forward logs to the renderer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-console
  const origLog: (...args: any[]) => void = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const origDebug = console.debug;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-console
  console.log = (...args: any[]) => {
    origLog.apply(console, args);
    sendLog('info', args.map(String).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args);
    sendLog('warn', args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    sendLog('error', args.map(String).join(' '));
  };
  console.debug = (...args: unknown[]) => {
    origDebug.apply(console, args);
    sendLog('debug', args.map(String).join(' '));
  };

  [
    IPC.CONFIG_GET,
    IPC.CONFIG_SET,
    IPC.PERMISSION_REQUEST,
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
    IPC.SHELL_EXEC,
    IPC.AGENT_RUN,
    IPC.AGENT_CLEAR,
    IPC.MEMORY_GET,
    IPC.MEMORY_SET,
    IPC.COMPACT,
    IPC.SESSIONS_SAVE,
    IPC.SESSIONS_LOAD,
    IPC.MESSAGES_SAVE,
    IPC.MESSAGES_LOAD,
    IPC.GIT_INFO,
    IPC.TOOLS_LIST,
    IPC.MCP_SERVERS_GET,
    IPC.MCP_SERVERS_ADD,
    IPC.MCP_SERVERS_REMOVE,
    IPC.MCP_SERVERS_TOGGLE,
    IPC.AUTOMATION_RULES_GET,
    IPC.AUTOMATION_RULES_ADD,
    IPC.AUTOMATION_RULES_REMOVE,
    IPC.AUTOMATION_RULES_TOGGLE,
    IPC.AUTOMATION_RULES_UPDATE,
    IPC.AUTOMATION_EXECUTIONS_GET,
    IPC.AUTOMATION_RUN,
    IPC.TTS_GENERATE,
    IPC.TTS_SAVE,
    IPC.API_VALIDATE,
    IPC.SKILLS_LIST,
    IPC.SKILLS_MATCH,
    IPC.SKILLS_ACTIVATE,
    IPC.SYSTEM_GET_INFO,
    IPC.COLLABORATION_LIST,
    IPC.SUPERVISOR_GET_VIOLATIONS,
    IPC.SUPERVISOR_SET_ENABLED,
    IPC.CONSOLE_GET_LOGS,
  ].forEach((channel) => ipcMain.removeHandler(channel));

  [IPC.WINDOW_MINIMIZE, IPC.WINDOW_MAXIMIZE, IPC.WINDOW_CLOSE, IPC.AGENT_STOP].forEach((channel) => {
    ipcMain.removeAllListeners(channel);
  });

  ipcMain.handle(IPC.CONFIG_GET, () => getPublicConfig());
  ipcMain.handle(IPC.CONFIG_SET, (_, key: string, value: unknown) => {
    if (!isConfigKey(key)) throw new Error(`Unknown config key: ${key}`);
    (currentConfig as unknown as Record<string, unknown>)[key] = validateConfigValue(key, value);

    // Save config to disk
    saveConfig(currentConfig);
    sendLog('info', `Config updated: ${key}`, 'Config');

    if (['apiKey', 'apiBase', 'model', 'permissionMode', 'toolPreset', 'maxTurns', 'temperature', 'sandboxEnabled', 'reasoningEffort'].includes(key)) {
      sendLog('info', `Reinitializing agent due to config change: ${key}`, 'Config');
      debouncedInit();
    }

    return getPublicConfig();
  });

  // Permission request handler - shows native dialog
  ipcMain.handle(IPC.PERMISSION_REQUEST, async (_, params: { toolName: string; description: string; riskLevel: string }) => {
    const { toolName, description, riskLevel } = params;

    // Auto-allow for safe operations in full-auto mode
    if (currentConfig.permissionMode === 'full-auto' && riskLevel !== 'destructive') {
      return { allowed: true };
    }

    // Show native dialog for permission confirmation
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['允许', '拒绝'],
      defaultId: 1,
      title: '权限请求',
      message: `是否允许执行操作？`,
      detail: `工具: ${toolName}\n风险级别: ${riskLevel}\n\n${description}`,
      cancelId: 1,
      noLink: true,
    });

    return { allowed: result.response === 0 };
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
      id: generateId(),
      name: name || `对话 ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      workspacePath: ws,
      workspaceName: ws ? basename(ws) : '',
    };
    sessions.push(session);
    activeSessionId = session.id;
    saveSessionsToDisk(sessions);
    sendLog('info', `Session created: ${session.name} (${session.id})`, 'Session');
    return session;
  });
  ipcMain.handle(IPC.SESSION_SWITCH, (_, id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      const oldWorkspace = getCurrentWorkspace();
      activeSessionId = id;
      const newWorkspace = getCurrentWorkspace();

      // If workspace changed, reinitialize agent with new workspace
      if (newWorkspace !== oldWorkspace && currentConfig.apiKey) {
        console.debug('[IPC] Session switched, workspace changed, reinitializing agent...');
        sendLog('info', `Session switched to ${id}, workspace changed, reinitializing agent`, 'Session');
        debouncedInit();
      }
      return session;
    }
    return null;
  });
  ipcMain.handle(IPC.SESSION_DELETE, (_, id: string) => {
    if (id === 'default') return getActiveSession();
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sessions.splice(idx, 1);
      if (sessions.length === 0) sessions = [createDefaultSession()];
      if (activeSessionId === id) activeSessionId = sessions[0].id;
      saveSessionsToDisk(sessions);
      sendLog('info', `Session deleted: ${id}`, 'Session');
    }
  });
  ipcMain.handle(IPC.SESSION_RENAME, (_, id: string, name: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      session.name = name;
      session.updatedAt = new Date().toISOString();
      saveSessionsToDisk(sessions);
    }
  });
  ipcMain.handle(IPC.SESSION_SET_WORKSPACE, (_, id: string, path: string) => {
    const workspace = setWorkspace(path);
    const session = sessions.find((s) => s.id === id);
    if (!session) throw new Error('Session not found');
    session.workspacePath = workspace.path;
    session.workspaceName = workspace.name;
    session.updatedAt = new Date().toISOString();
    saveSessionsToDisk(sessions);
    return session;
  });

  ipcMain.handle(IPC.FILE_DIALOG, async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle(IPC.FILE_LIST, async (_, path?: string) => listFiles(path));
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
      sendLog('info', 'Agent run started', 'Agent');
      if (currentConfig.apiKey) {
        sendLog('info', 'Initializing agent service', 'Agent');
        await agentService.initialize({ ...currentConfig }, ws);
      }
      await agentService.run(prompt, ws);
      sendLog('info', 'Agent run completed', 'Agent');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[IPC] Agent error:', message);
      sendLog('error', `Agent error: ${message}`, 'Agent');
      mainWindow.webContents.send(IPC.AGENT_ERROR, message);
    }
  });

  ipcMain.on(IPC.AGENT_STOP, () => {
    sendLog('info', 'Agent stop requested', 'Agent');
    agentService.stop();
  });

  ipcMain.handle(IPC.AGENT_CLEAR, () => {
    sendLog('info', 'Agent conversation cleared', 'Agent');
    agentService.clear();
  });

  ipcMain.handle(IPC.MEMORY_GET, async () => {
    try {
      const agent = agentService.getAgent?.();
      const memory = agent?.getMemory?.();
      return { content: memory?.getContent?.() || '' };
    } catch (err) {
      console.warn('[MEMORY_GET] Failed to get memory:', err);
      return { content: '' };
    }
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
      const { compactMessages, shouldCompact } = await import(compactionUrl);
      if (shouldCompact(conversation)) {
        const compacted = compactMessages(conversation);
        agent.setConversation(compacted);
        return { success: true, messageCount: compacted.length };
      }
      return { success: true, messageCount: conversation.length, compacted: false };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle(IPC.SESSIONS_SAVE, async (_event, sessionsData: Session[]) => {
    sessions = normalizeSessions(sessionsData);
    if (!sessions.some((session) => session.id === activeSessionId)) {
      activeSessionId = sessions[0].id;
    }
    return saveSessionsToDisk(sessions);
  });

  ipcMain.handle(IPC.SESSIONS_LOAD, async () => {
    sessions = loadSessionsFromDisk();
    if (!sessions.some((session) => session.id === activeSessionId)) {
      activeSessionId = sessions[0].id;
    }
    return { sessions };
  });

  // Message persistence per session
  const MESSAGES_DIR = join(app.getPath('userData'), 'messages');

  // Sanitize session ID to prevent path traversal
  function sanitizeSessionId(sessionId: string): string {
    // Only allow alphanumeric, hyphens, underscores, and dots
    const sanitized = sessionId.replace(/[^a-zA-Z0-9_.-]/g, '_');
    // Remove any path separators
    return sanitized.replace(/\.\./g, '_').replace(/[/\\]/g, '_');
  }

  ipcMain.handle(IPC.MESSAGES_SAVE, async (_event, sessionId: string, messages: unknown[]) => {
    try {
      if (!existsSync(MESSAGES_DIR)) mkdirSync(MESSAGES_DIR, { recursive: true });
      const safeId = sanitizeSessionId(sessionId);
      const filePath = join(MESSAGES_DIR, `${safeId}.json`);
      writeFileSync(filePath, JSON.stringify(messages, null, 2));
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle(IPC.MESSAGES_LOAD, async (_event, sessionId: string) => {
    try {
      const safeId = sanitizeSessionId(sessionId);
      const filePath = join(MESSAGES_DIR, `${safeId}.json`);
      if (!existsSync(filePath)) return { messages: [] };
      const data = readFileSync(filePath, 'utf-8');
      return { messages: JSON.parse(data) };
    } catch (err) {
      console.warn('[MESSAGES_LOAD] Failed to load messages:', err);
      return { messages: [] };
    }
  });

  ipcMain.handle(IPC.GIT_INFO, async () => {
    const workspace = getCurrentWorkspace();
    try {
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspace,
        encoding: 'utf-8',
        timeout: 10000,
      });

      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: workspace,
        encoding: 'utf-8',
        timeout: 10000,
      });

      const changedFiles = statusOutput ? statusOutput.split('\n').filter(Boolean).length : 0;

      return { branch: branch.trim(), changedFiles };
    } catch (err) {
      // Git info is optional, just return empty if not a git repo
      console.debug('[GIT_INFO] Not a git repo or git not available:', err);
      return { branch: '', changedFiles: 0 };
    }
  });

  // === Tools ===
  ipcMain.handle(IPC.TOOLS_LIST, async () => {
    try {
      const agent = agentService.getAgent();
      if (!agent) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registry = (agent as any).toolRegistry;
      if (!registry) return [];
      const tools = registry.getAll ? registry.getAll() : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return tools.map((t: any): ToolInfo => ({
        name: t.name || '',
        description: t.description || '',
        riskLevel: t.riskLevel || 'safe',
        categories: t.categories || [],
        parameterCount: t.parameters?.function?.parameters?.properties ? Object.keys(t.parameters.function.parameters.properties).length : 0,
      }));
    } catch (err) {
      console.warn('[TOOLS_LIST] Failed to list tools:', err);
      return [];
    }
  });

  // === MCP Servers ===
  function loadMcpServers(): McpServerConfig[] {
    try {
      if (!existsSync(MCP_SERVERS_FILE)) return [];
      return JSON.parse(readFileSync(MCP_SERVERS_FILE, 'utf-8'));
    } catch (err) {
      console.warn('[loadMcpServers] Failed to load MCP servers config:', err);
      return [];
    }
  }

  function saveMcpServers(servers: McpServerConfig[]) {
    writeFileSync(MCP_SERVERS_FILE, JSON.stringify(servers, null, 2));
  }

  ipcMain.handle(IPC.MCP_SERVERS_GET, async () => loadMcpServers());

  ipcMain.handle(IPC.MCP_SERVERS_ADD, async (_event, server: Omit<McpServerConfig, 'id' | 'enabled'>) => {
    const servers = loadMcpServers();
    const newServer: McpServerConfig = { ...server, id: generateId(), enabled: true };
    servers.push(newServer);
    saveMcpServers(servers);
    sendLog('info', `MCP server added: ${server.name || server.command}`, 'MCP');
    return newServer;
  });

  ipcMain.handle(IPC.MCP_SERVERS_REMOVE, async (_event, id: string) => {
    const servers = loadMcpServers().filter(s => s.id !== id);
    saveMcpServers(servers);
    sendLog('info', `MCP server removed: ${id}`, 'MCP');
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
    } catch (err) {
      console.warn('[loadAutomationRules] Failed to load automation rules:', err);
      return getDefaultAutomationRules();
    }
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
    } catch (err) {
      console.warn('[loadExecutions] Failed to load automation executions:', err);
      return [];
    }
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

    sendLog('info', `Running automation rule: ${rule.name} (${rule.id})`, 'Automation');

    const startTime = Date.now();
    try {
      if (rule.action.type === 'run-prompt') {
        const prompt = rule.action.config.prompt as string;

        // Notify frontend to start streaming mode before running agent
        mainWindow.webContents.send(IPC.AGENT_THINKING);

        await agentService.run(prompt);
        const exec: AutomationExecution = {
          id: generateId(),
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
        const config = rule.action.config as Record<string, unknown>;
        const command = (config.command as string) || ((config.args as Record<string, string>)?.command);
        if (!command) throw new Error('缺少执行命令');

        // Safety: block obviously destructive commands
        const dangerous = [
          'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=', ':(){:|:&};:',
          'curl | sh', 'curl | bash', 'wget | sh', 'wget | bash',
          'wget -O- | bash', 'chmod -R 777 /', '> /dev/sda',
          'mv / ', 'rm -rf ~', 'rm -rf $HOME',
        ];
        for (const pattern of dangerous) {
          if (command.includes(pattern)) {
            throw new Error(`Blocked dangerous command: ${command}`);
          }
        }

        const { stdout: output } = await execAsync(command, { timeout: 30000, encoding: 'utf-8', cwd: getCurrentWorkspace() });
        const exec: AutomationExecution = {
          id: generateId(),
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
        id: generateId(),
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
      const { text, model, voice, speed: _speed, thinkingIntensity } = params;
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
    const { filePath } = await dialog.showSaveDialog(mainWindow as BrowserWindow, {
      title: '保存语音文件',
      defaultPath: `tts-${Date.now()}.wav`,
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
    });
    if (!filePath) return { success: false, error: '已取消' };
    writeFileSync(filePath, buf);
    return { success: true, filePath };
  });

  // === API Key Validation ===
  ipcMain.handle(IPC.API_VALIDATE, async () => {
    const { apiKey, apiBase } = currentConfig;
    if (!apiKey) return { valid: false, error: '未配置 API Key' };
    try {
      const chatBase = apiBase.replace(/\/v1\/?$/, '') + '/v1';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${chatBase}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: currentConfig.model || 'mimo-v2.5-pro', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return { valid: true };
      const body = await res.text().catch(() => '');
      return { valid: false, error: `HTTP ${res.status}: ${body.slice(0, 120)}` };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { valid: false, error: msg };
    }
  });

  // === Skills ===
  ipcMain.handle(IPC.SKILLS_LIST, () => {
    // Return built-in skills list
    return {
      skills: [
        { id: 'code-review', name: '代码审查', description: '审查代码质量、发现潜在问题、提供改进建议', triggers: ['审查', 'review', '检查代码', '代码质量'], icon: 'Search', priority: 8 },
        { id: 'refactor', name: '代码重构', description: '优化代码结构、提高可读性和可维护性', triggers: ['重构', '优化', 'refactor', 'clean up'], icon: 'Shuffle', priority: 7 },
        { id: 'debug', name: '调试辅助', description: '帮助定位和修复 bug', triggers: ['调试', 'bug', '错误', 'debug', 'fix', '修复'], icon: 'Bug', priority: 9 },
        { id: 'test', name: '测试生成', description: '为代码生成单元测试和集成测试', triggers: ['测试', 'test', '单测', '单元测试'], icon: 'TestTube', priority: 6 },
        { id: 'docs', name: '文档生成', description: '为代码生成文档和注释', triggers: ['文档', 'docs', '注释', 'documentation'], icon: 'FileText', priority: 5 },
        { id: 'git-workflow', name: 'Git 工作流', description: '辅助 Git 操作，如提交、分支管理等', triggers: ['提交', 'commit', '分支', 'branch', 'git'], icon: 'GitBranch', priority: 4 },
        { id: 'architecture', name: '架构设计', description: '帮助设计系统架构和模块划分', triggers: ['架构', '设计', 'architecture', 'design'], icon: 'Layout', priority: 6 },
      ],
    };
  });

  ipcMain.handle(IPC.SKILLS_MATCH, (_event, input: string) => {
    // Simple keyword matching
    const skills = [
      { id: 'code-review', name: '代码审查', description: '审查代码质量', triggers: ['审查', 'review', '检查代码'], icon: 'Search', priority: 8 },
      { id: 'refactor', name: '代码重构', description: '优化代码结构', triggers: ['重构', '优化', 'refactor'], icon: 'Shuffle', priority: 7 },
      { id: 'debug', name: '调试辅助', description: '定位和修复 bug', triggers: ['调试', 'bug', '错误', 'debug', 'fix', '修复'], icon: 'Bug', priority: 9 },
      { id: 'test', name: '测试生成', description: '生成测试代码', triggers: ['测试', 'test', '单测'], icon: 'TestTube', priority: 6 },
      { id: 'docs', name: '文档生成', description: '生成文档', triggers: ['文档', 'docs', '注释'], icon: 'FileText', priority: 5 },
      { id: 'git-workflow', name: 'Git 工作流', description: 'Git 操作', triggers: ['提交', 'commit', '分支', 'git'], icon: 'GitBranch', priority: 4 },
      { id: 'architecture', name: '架构设计', description: '系统架构设计', triggers: ['架构', '设计', 'architecture'], icon: 'Layout', priority: 6 },
    ];

    const normalizedInput = input.toLowerCase();
    const matches = [];

    for (const skill of skills) {
      const matchedTriggers = skill.triggers.filter(t => normalizedInput.includes(t.toLowerCase()));
      if (matchedTriggers.length > 0) {
        const confidence = Math.min(0.5 + matchedTriggers.length * 0.2, 1.0);
        matches.push({ skill, confidence, matchedTriggers });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    return { matches: matches.slice(0, 3) };
  });

  ipcMain.handle(IPC.SKILLS_ACTIVATE, (_event, skillId: string) => {
    // Activate a skill (could trigger tool loading, etc.)
    console.debug('[Skills] Activating skill:', skillId);
    sendLog('info', `Activating skill: ${skillId}`, 'Skills');
    return { success: true, skillId };
  });

  // === System Info ===
  ipcMain.handle(IPC.SYSTEM_GET_INFO, async () => {
    // CPU usage: sample twice over 100ms and compute busy fraction
    const cpus1 = os.cpus();
    await new Promise((r) => setTimeout(r, 100));
    const cpus2 = os.cpus();

    let totalIdleDelta = 0;
    let totalDelta = 0;
    for (let i = 0; i < cpus1.length; i++) {
      const t1 = cpus1[i].times;
      const t2 = cpus2[i].times;
      const idleDelta = t2.idle - t1.idle;
      const total =
        (t2.user - t1.user) +
        (t2.nice - t1.nice) +
        (t2.sys - t1.sys) +
        (t2.idle - t1.idle) +
        (t2.irq - t1.irq);
      totalIdleDelta += idleDelta;
      totalDelta += total;
    }
    const cpuUsage = totalDelta > 0 ? ((totalDelta - totalIdleDelta) / totalDelta) * 100 : 0;

    // Memory
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const memoryTotal = totalMemBytes / (1024 ** 3);
    const memoryUsage = (totalMemBytes - freeMemBytes) / (1024 ** 3);

    // Disk usage (Windows: wmic logicaldisk)
    let diskUsage = 0;
    try {
      const drive = process.env.SystemDrive || 'C:';
      const output = execSync(
        `wmic logicaldisk where "DeviceID='${drive}'" get Size,FreeSpace /format:csv`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      const lines = output.trim().split('\n').filter(Boolean);
      // CSV output: Node,FreeSpace,Size — last non-empty line has data
      const dataLine = lines[lines.length - 1];
      if (dataLine) {
        const parts = dataLine.split(',');
        const freeSpace = parseInt(parts[1], 10);
        const size = parseInt(parts[2], 10);
        if (size > 0) {
          diskUsage = ((size - freeSpace) / size) * 100;
        }
      }
    } catch {
      // disk usage stays 0 if unavailable
    }

    // Uptime in milliseconds
    const uptime = os.uptime() * 1000;

    return { cpuUsage, memoryUsage, memoryTotal, diskUsage, uptime };
  });

  // === Collaboration ===
  ipcMain.handle(IPC.COLLABORATION_LIST, () => {
    return { collaborations: collaborationTasks };
  });

  // === Supervisor ===
  let supervisorEnabled = false;
  const violations: Violation[] = [];
  const MAX_VIOLATIONS = 200;

  ipcMain.handle(IPC.SUPERVISOR_GET_VIOLATIONS, () => {
    return { violations, enabled: supervisorEnabled };
  });

  ipcMain.handle(IPC.SUPERVISOR_SET_ENABLED, (_event, enabled: boolean) => {
    supervisorEnabled = enabled;
    console.debug('[Supervisor] Enabled:', enabled);
    sendLog('info', `Supervisor ${enabled ? 'enabled' : 'disabled'}`, 'Supervisor');
    return { success: true, enabled };
  });

  // Expose checkToolOutput so AgentService can call it after tool execution
  function checkToolOutput(toolName: string, output: string, filePath?: string): void {
    if (!supervisorEnabled) return;
    const newViolations = runRules(output, { filePath, toolName });
    for (const v of newViolations) {
      violations.push(v);
      if (violations.length > MAX_VIOLATIONS) violations.shift();
      mainWindow.webContents.send(IPC.SUPERVISOR_VIOLATION, v);
    }
  }

  // Store reference for external access
  supervisorCheckToolOutput = checkToolOutput;

  // Wire up supervisor check from agent-service
  agentService.setSupervisorCallback((toolName, output, filePath) => {
    checkToolOutput(toolName, output, filePath);
  });

  // === Console Log Buffer ===
  ipcMain.handle(IPC.CONSOLE_GET_LOGS, () => logBuffer);
}

/**
 * Check tool output against supervisor rules.
 * Call this from AgentService after tool execution (write_file, edit_file, shell).
 * Returns early if supervisor is not enabled or registerIpcHandlers hasn't been called.
 */
export function checkToolOutput(toolName: string, output: string, filePath?: string): void {
  supervisorCheckToolOutput?.(toolName, output, filePath);
}
