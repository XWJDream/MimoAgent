/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect, it, vi } from 'vitest';

// Hoisted mocks shared between vi.mock factories and test code
const { handlers, mockWriteFileSync } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/mock/app',
    getPath: () => '/mock/userData',
  },
  BrowserWindow: class {},
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true, filePath: '' }),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
    on: vi.fn(),
    removeHandler: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (typeof path === 'string' && path.includes('config.json')) return true;
    return false;
  }),
  readFileSync: vi.fn((path: string) => {
    if (typeof path === 'string' && path.includes('config.json')) {
      return JSON.stringify({ apiKey: 'sk-test-1234567890' });
    }
    return '{}';
  }),
  mkdirSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({
    isDirectory: () => true,
    isFile: () => true,
    size: 100,
    mtimeMs: Date.now(),
  }),
  writeFileSync: mockWriteFileSync,
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('./agent-service.js', () => ({
  AgentService: class {
    setMainWindow() {}
    setCollaborationCallback() {}
    setSupervisorCallback() {}
    async initialize() {}
    async run() {}
    stop() {}
    clear() {}
    getAgent() { return null; }
  },
}));

vi.mock('./tts-store.js', () => ({
  ttsAudioStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    size: 0,
    clear: vi.fn(),
  },
}));

vi.mock('./storage/database.js', () => ({
  initDatabase: vi.fn(),
  getDatabase: vi.fn(),
  _resetDatabase: vi.fn(),
}));

vi.mock('./storage/session-repo.js', () => ({
  listSessions: vi.fn().mockReturnValue([]),
  getSession: vi.fn().mockReturnValue(undefined),
  createSession: vi.fn().mockImplementation((data: { id?: string; title: string }) => ({
    id: data.id || `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`,
    title: data.title,
    workspace_path: '',
    workspace_name: '',
    parent_id: null,
    status: 'active',
    created_at: Date.now(),
    updated_at: Date.now(),
    message_count: 0,
  })),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  archiveSession: vi.fn(),
  forkSession: vi.fn(),
  searchSessions: vi.fn().mockReturnValue([]),
}));

vi.mock('./storage/message-repo.js', () => ({
  listMessages: vi.fn().mockReturnValue([]),
  saveMessages: vi.fn().mockReturnValue(0),
  appendMessage: vi.fn(),
  deleteMessagesBySession: vi.fn(),
  getMessageCount: vi.fn().mockReturnValue(0),
}));

vi.mock('./storage/migrate.js', () => ({
  migrateFromJson: vi.fn().mockResolvedValue({ sessions: 0, messages: 0 }),
}));

const { migrateStoredConfig, registerIpcHandlers } = await import('./ipc.js');
const { dialog: mockedDialog } = await import('electron');

const mockWindow = {
  webContents: { send: vi.fn() },
  minimize: vi.fn(),
  maximize: vi.fn(),
  unmaximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn().mockReturnValue(false),
  isDestroyed: vi.fn().mockReturnValue(false),
};

registerIpcHandlers(mockWindow as unknown as import('electron').BrowserWindow);

describe('ipc', () => {
  describe('config migration', () => {
    it('preserves a user theme after the sakura migration has run', () => {
      const result = migrateStoredConfig({ configSchemaVersion: 1, theme: 'dark' });
      expect(result.migrated).toBe(false);
      expect(result.config.theme).toBe('dark');
    });
  });

  describe('CONFIG_GET - maskApiKey', () => {
    it('should mask API key showing only first 4 and last 4 characters', () => {
      const handler = handlers.get('config:get')!;
      const result = handler();
      // maskApiKey('sk-test-1234567890') -> 'sk-t****7890'
      expect(result.apiKeyPreview).toBe('sk-t****7890');
    });

    it('should set apiKeyConfigured to true when key exists', () => {
      const handler = handlers.get('config:get')!;
      const result = handler();
      expect(result.apiKeyConfigured).toBe(true);
    });

    it('should not expose raw API key in public config', () => {
      const handler = handlers.get('config:get')!;
      const result = handler();
      expect(result.apiKey).toBeUndefined();
    });

    it('should migrate an unversioned config to sakura without exposing the schema version', () => {
      const handler = handlers.get('config:get')!;
      const result = handler();
      expect(result.theme).toBe('sakura');
      expect(result.configSchemaVersion).toBeUndefined();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.stringContaining('"configSchemaVersion": 1'),
        'utf-8',
      );
    });
  });

  describe('CONFIG_SET - validateConfigValue', () => {
    it('should reject unknown config keys', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'unknownKey', 'value')).toThrow();
    });

    it('should validate maxTurns as integer between 1 and 200', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'maxTurns', 'not-a-number')).toThrow();
      expect(() => handler({}, 'maxTurns', 0)).toThrow();
      expect(() => handler({}, 'maxTurns', 201)).toThrow();
      expect(() => handler({}, 'maxTurns', 1.5)).toThrow();
    });

    it('should accept valid maxTurns and return updated config', () => {
      const handler = handlers.get('config:set')!;
      const result = handler({}, 'maxTurns', 100);
      expect(result.maxTurns).toBe(100);
    });

    it('should validate temperature range 0-2', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'temperature', -0.1)).toThrow();
      expect(() => handler({}, 'temperature', 2.1)).toThrow();
      expect(() => handler({}, 'temperature', 1.0)).not.toThrow();
    });

    it('should validate permissionMode values', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'permissionMode', 'invalid')).toThrow();
      expect(() => handler({}, 'permissionMode', 'suggest')).not.toThrow();
      expect(() => handler({}, 'permissionMode', 'auto-edit')).not.toThrow();
      expect(() => handler({}, 'permissionMode', 'full-auto')).not.toThrow();
    });

    it('should validate toolPreset values', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'toolPreset', 'invalid')).toThrow();
      expect(() => handler({}, 'toolPreset', 'plan')).not.toThrow();
      expect(() => handler({}, 'toolPreset', 'act')).not.toThrow();
    });

    it('should accept sakura as a theme', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'theme', 'sakura')).not.toThrow();
      expect(() => handler({}, 'theme', 'invalid')).toThrow();
    });

    it('should validate sandboxEnabled as boolean', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'sandboxEnabled', 'yes')).toThrow();
      expect(() => handler({}, 'sandboxEnabled', true)).not.toThrow();
      expect(() => handler({}, 'sandboxEnabled', false)).not.toThrow();
    });

    it('should validate apiBase as HTTP(S) URL', () => {
      const handler = handlers.get('config:set')!;
      expect(() => handler({}, 'apiBase', 'not-a-url')).toThrow();
      expect(() => handler({}, 'apiBase', 'ftp://invalid.com')).toThrow();
      expect(() => handler({}, 'apiBase', 'https://api.example.com/v1')).not.toThrow();
      expect(() => handler({}, 'apiBase', 'http://localhost:3000')).not.toThrow();
    });
  });

  describe('SESSION_CREATE - generateId', () => {
    it('should generate a session ID with correct format', () => {
      const handler = handlers.get('session:create')!;
      const session = handler({}, 'Test Session');
      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe('string');
      // Format: base36(timestamp)-hex(8 chars)
      expect(session.id).toMatch(/^[a-z0-9]+-[a-f0-9]{8}$/);
    });

    it('should generate different IDs for consecutive sessions', () => {
      const handler = handlers.get('session:create')!;
      const s1 = handler({}, 'Session 1');
      const s2 = handler({}, 'Session 2');
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('FILE_ATTACHMENTS_PICK', () => {
    it('returns selected text files with readable content', async () => {
      vi.mocked(mockedDialog.showOpenDialog).mockResolvedValueOnce({
        canceled: false,
        filePaths: ['C:\\notes.md'],
      });
      const handler = handlers.get('file:attachments-pick')!;
      const result = await handler({});

      expect(result).toEqual([expect.objectContaining({
        name: 'notes.md',
        path: 'C:\\notes.md',
        kind: 'text',
        content: '{}',
      })]);
    });
  });

  describe('MESSAGES_SAVE - SQLite storage', () => {
    it('should save messages via SQLite repo', async () => {
      const handler = handlers.get('messages:save')!;
      const result = await handler({}, 'test-session', [{ id: 'm1', role: 'user', content: 'hello', timestamp: Date.now() }]);
      expect(result.success).toBe(true);
    });

    it('should handle empty messages array', async () => {
      const handler = handlers.get('messages:save')!;
      const result = await handler({}, 'test-session', []);
      expect(result.success).toBe(true);
    });

    it('should handle wrapped message format', async () => {
      const handler = handlers.get('messages:save')!;
      const result = await handler({}, 'test-session', {
        messages: [{ id: 'm1', role: 'user', content: 'hello', timestamp: Date.now() }],
        usage: { sessionTokens: 100 },
      });
      expect(result.success).toBe(true);
    });
  });
});
