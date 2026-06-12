import { create } from 'zustand';
import type { Session, WorkspaceInfo } from '@shared/types';
import { useToastStore } from './toastStore';

interface SessionState {
  sessions: Session[];
  activeSessionId: string;
  loaded: boolean;
  searchResults: Session[];
  searching: boolean;

  setSessions: (sessions: Session[]) => void;
  setActiveSession: (id: string) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setSessionWorkspace: (id: string, workspace: WorkspaceInfo) => void;
  loadSessions: () => Promise<void>;
  saveSessions: () => Promise<void>;
  forkSession: (id: string, title: string) => Promise<Session | null>;
  archiveSession: (id: string) => Promise<void>;
  searchSessions: (query: string) => Promise<void>;
  clearSearch: () => void;
}

const DEFAULT_SESSION: Session = {
  id: 'default',
  name: '新对话',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messageCount: 0,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [DEFAULT_SESSION],
  activeSessionId: 'default',
  loaded: false,
  searchResults: [],
  searching: false,

  setSessions: (sessions) => {
    set({ sessions });
    get().saveSessions();
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  addSession: (session) => {
    set((state) => ({ sessions: [...state.sessions, session] }));
    get().saveSessions();
  },

  removeSession: (id) => {
    if (id === 'default') return;
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== id);
      const newActive = state.activeSessionId === id
        ? (newSessions[0]?.id || 'default')
        : state.activeSessionId;
      return { sessions: newSessions.length > 0 ? newSessions : [DEFAULT_SESSION], activeSessionId: newActive };
    });
    get().saveSessions();
  },

  renameSession: (id, name) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s
      ),
    }));
    get().saveSessions();
  },

  setSessionWorkspace: (id, workspace) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, workspacePath: workspace.path, workspaceName: workspace.name, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
    get().saveSessions();
  },

  loadSessions: async () => {
    try {
      const result = await window.api?.sessions?.load();
      if (result?.sessions && result.sessions.length > 0) {
        set({ sessions: result.sessions, loaded: true });
      } else {
        set({ sessions: [DEFAULT_SESSION], loaded: true });
      }
    } catch {
      set({ sessions: [DEFAULT_SESSION], loaded: true });
    }
  },

  saveSessions: async () => {
    const { sessions } = get();
    try {
      await window.api?.sessions?.save(sessions);
    } catch (err) {
      console.error('Failed to save sessions:', err);
    }
  },

  forkSession: async (id, title) => {
    try {
      const session = await window.api?.session?.fork(id, title);
      if (session) {
        set((state) => ({ sessions: [...state.sessions, session] }));
        return session;
      }
      return null;
    } catch (err) {
      console.error('Failed to fork session:', err);
      return null;
    }
  },

  archiveSession: async (id) => {
    try {
      await window.api?.session?.archive(id);
      set((state) => ({
        sessions: state.sessions.map(s => s.id === id ? { ...s, updatedAt: new Date().toISOString() } : s),
      }));
    } catch (err) {
      console.error('Failed to archive session:', err);
    }
  },

  searchSessions: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], searching: false });
      return;
    }
    set({ searching: true });
    try {
      const results = await window.api?.session?.search(query);
      set({ searchResults: results || [], searching: false });
    } catch (err) {
      console.error('Failed to search sessions:', err);
      useToastStore.getState().addToast('搜索会话失败', 'error');
      set({ searchResults: [], searching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], searching: false }),
}));
