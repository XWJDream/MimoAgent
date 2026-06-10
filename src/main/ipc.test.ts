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

const { registerIpcHandlers } = await import('./ipc.js');

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

  describe('MESSAGES_SAVE - sanitizeSessionId', () => {
    it('should sanitize path traversal sequences in session ID', async () => {
      mockWriteFileSync.mockClear();
      const handler = handlers.get('messages:save')!;
      const result = await handler({}, '../../../etc/passwd', []);
      expect(result.success).toBe(true);
      const writeCall = mockWriteFileSync.mock.calls.find((c: unknown[]) =>
        typeof c[0] === 'string' && (c[0] as string).endsWith('.json')
      );
      expect(writeCall).toBeDefined();
      expect((writeCall as unknown[])[0]).not.toContain('..');
    });

    it('should sanitize backslash path separators in session ID', async () => {
      mockWriteFileSync.mockClear();
      const handler = handlers.get('messages:save')!;
      await handler({}, '..\\..\\secret', []);
      const writeCall = mockWriteFileSync.mock.calls.find((c: unknown[]) =>
        typeof c[0] === 'string' && (c[0] as string).endsWith('.json')
      );
      // The filename portion should not contain the original malicious input
      const filename = ((writeCall as unknown[])[0] as string).split(/[/\\]/).pop()!;
      expect(filename).not.toContain('..');
      expect(filename).toBe('____secret.json');
    });

    it('should keep normal session IDs intact', async () => {
      mockWriteFileSync.mockClear();
      const handler = handlers.get('messages:save')!;
      await handler({}, 'normal-session-id', []);
      const writeCall = mockWriteFileSync.mock.calls.find((c: unknown[]) =>
        typeof c[0] === 'string' && (c[0] as string).endsWith('.json')
      );
      expect((writeCall as unknown[])[0]).toContain('normal-session-id');
    });
  });
});
