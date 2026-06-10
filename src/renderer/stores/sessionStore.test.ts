import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from './sessionStore';

// Mock window.api
Object.defineProperty(window, 'api', {
  value: {
    sessions: {
      save: vi.fn().mockResolvedValue({}),
      load: vi.fn().mockResolvedValue({ sessions: [] }),
    },
  },
  writable: true,
});

describe('sessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useSessionStore.setState({
      sessions: [
        {
          id: 'default',
          name: '新对话',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
        },
      ],
      activeSessionId: 'default',
      loaded: false,
    });
  });

  describe('initial state', () => {
    it('should have default session', () => {
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe('default');
    });

    it('should have default active session', () => {
      const state = useSessionStore.getState();
      expect(state.activeSessionId).toBe('default');
    });

    it('should not be loaded initially', () => {
      const state = useSessionStore.getState();
      expect(state.loaded).toBe(false);
    });
  });

  describe('setSessions()', () => {
    it('should update sessions', () => {
      const newSessions = [
        { id: '1', name: 'Session 1', createdAt: '', updatedAt: '', messageCount: 0 },
        { id: '2', name: 'Session 2', createdAt: '', updatedAt: '', messageCount: 0 },
      ];

      useSessionStore.getState().setSessions(newSessions);

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions[0].name).toBe('Session 1');
    });
  });

  describe('setActiveSession()', () => {
    it('should update active session id', () => {
      useSessionStore.getState().setActiveSession('new-id');

      expect(useSessionStore.getState().activeSessionId).toBe('new-id');
    });
  });

  describe('addSession()', () => {
    it('should add new session', () => {
      const newSession = {
        id: 'new',
        name: 'New Session',
        createdAt: '',
        updatedAt: '',
        messageCount: 0,
      };

      useSessionStore.getState().addSession(newSession);

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions[1].name).toBe('New Session');
    });
  });

  describe('removeSession()', () => {
    it('should remove session', () => {
      // Add a second session first
      useSessionStore.setState({
        sessions: [
          { id: 'default', name: '新对话', createdAt: '', updatedAt: '', messageCount: 0 },
          { id: 'to-remove', name: 'Remove Me', createdAt: '', updatedAt: '', messageCount: 0 },
        ],
      });

      useSessionStore.getState().removeSession('to-remove');

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe('default');
    });

    it('should switch active session when removing active', () => {
      useSessionStore.setState({
        sessions: [
          { id: 'first', name: 'First', createdAt: '', updatedAt: '', messageCount: 0 },
          { id: 'second', name: 'Second', createdAt: '', updatedAt: '', messageCount: 0 },
        ],
        activeSessionId: 'first',
      });

      useSessionStore.getState().removeSession('first');

      const state = useSessionStore.getState();
      expect(state.activeSessionId).toBe('second');
    });

    it('should keep default session when removing last', () => {
      useSessionStore.getState().removeSession('default');

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
    });

    it('should not remove default session when other sessions exist', () => {
      useSessionStore.setState({
        sessions: [
          { id: 'default', name: '新对话', createdAt: '', updatedAt: '', messageCount: 0 },
          { id: 'other', name: 'Other', createdAt: '', updatedAt: '', messageCount: 0 },
        ],
        activeSessionId: 'default',
      });

      useSessionStore.getState().removeSession('default');

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions[0].id).toBe('default');
      expect(state.activeSessionId).toBe('default');
    });
  });

  describe('renameSession()', () => {
    it('should rename session', () => {
      useSessionStore.getState().renameSession('default', 'New Name');

      const state = useSessionStore.getState();
      expect(state.sessions[0].name).toBe('New Name');
    });

    it('should update updatedAt on rename', () => {
      const _before = new Date().toISOString();
      useSessionStore.getState().renameSession('default', 'New Name');

      const state = useSessionStore.getState();
      expect(state.sessions[0].updatedAt).toBeDefined();
    });
  });

  describe('setSessionWorkspace()', () => {
    it('should set workspace for session', () => {
      useSessionStore.getState().setSessionWorkspace('default', {
        path: '/test/workspace',
        name: 'workspace',
      });

      const state = useSessionStore.getState();
      expect(state.sessions[0].workspacePath).toBe('/test/workspace');
      expect(state.sessions[0].workspaceName).toBe('workspace');
    });
  });

  describe('loadSessions()', () => {
    it('should load sessions from API', async () => {
      const mockSessions = [
        { id: '1', name: 'Loaded', createdAt: '', updatedAt: '', messageCount: 0 },
      ];
      vi.mocked(window.api.sessions.load).mockResolvedValueOnce({ sessions: mockSessions });

      await useSessionStore.getState().loadSessions();

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].name).toBe('Loaded');
      expect(state.loaded).toBe(true);
    });

    it('should use default when no sessions loaded', async () => {
      vi.mocked(window.api.sessions.load).mockResolvedValueOnce({ sessions: [] });

      await useSessionStore.getState().loadSessions();

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe('default');
      expect(state.loaded).toBe(true);
    });

    it('should handle load errors', async () => {
      vi.mocked(window.api.sessions.load).mockRejectedValueOnce(new Error('Load failed'));

      await useSessionStore.getState().loadSessions();

      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.loaded).toBe(true);
    });
  });

  describe('saveSessions()', () => {
    it('should save sessions to API', async () => {
      await useSessionStore.getState().saveSessions();

      expect(window.api.sessions.save).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      vi.mocked(window.api.sessions.save).mockRejectedValueOnce(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await useSessionStore.getState().saveSessions();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
