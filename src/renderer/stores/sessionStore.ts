import { create } from 'zustand';
import type { Session, WorkspaceInfo } from '@shared/types';

interface SessionState {
  sessions: Session[];
  activeSessionId: string;

  setSessions: (sessions: Session[]) => void;
  setActiveSession: (id: string) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setSessionWorkspace: (id: string, workspace: WorkspaceInfo) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
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

  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (id) => set({ activeSessionId: id }),
  addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? 'default' : state.activeSessionId,
    })),
  renameSession: (id, name) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, name, updatedAt: new Date().toISOString() } : s)),
    })),
  setSessionWorkspace: (id, workspace) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id
          ? { ...s, workspacePath: workspace.path, workspaceName: workspace.name, updatedAt: new Date().toISOString() }
          : s,
      ),
    })),
}));
