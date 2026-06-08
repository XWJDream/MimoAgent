import React, { useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, GitBranch, MessageSquare, Plus, Search, Settings, Sparkles, Clock3, X, Volume2, Edit3, Zap, Terminal, Users, Shield } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useConfigStore } from '../../stores/configStore';
import { useT } from '../../i18n';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
  onOpenView: (view: 'chat' | 'workspace' | 'plugins' | 'automation' | 'tts' | 'skills' | 'console' | 'supervisor') => void;
  currentView: string;
}

export function Sidebar({ onOpenSettings, onOpenWorkspace, onOpenView, currentView }: SidebarProps) {
  const t = useT();
  const { sessions, activeSessionId, setSessions, setActiveSession, addSession, removeSession, renameSession, setSessionWorkspace } = useSessionStore();
  const switchSession = useChatStore((s) => s.switchSession);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const model = useConfigStore((s) => s.config.model);

  function basename(path?: string) {
    if (!path) return t('sidebar.noProject');
    const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized.split('/').pop() || normalized;
  }
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [gitBranch, setGitBranch] = useState<string>('');
  const [gitChangedFiles, setGitChangedFiles] = useState<number>(0);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (editingSessionId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSessionId]);

  const handleStartRename = (sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId);
    setEditingName(currentName);
  };

  const handleFinishRename = () => {
    if (editingSessionId && editingName.trim()) {
      renameSession(editingSessionId, editingName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleNewChat = async () => {
    const workspace = await window.api.workspace.select();
    if (!workspace) return;
    const session = await window.api.session.create(t('sidebar.sessionName', { count: sessions.length + 1 }), workspace.path);
    addSession(session);
    setActiveSession(session.id);
    clearMessages(session.id);
    onOpenView('chat');
  };

  useEffect(() => {
    if (!activeSession?.workspacePath) {
      setGitBranch('');
      setGitChangedFiles(0);
      return;
    }
    window.api.git.info().then((info: { branch: string; changedFiles: number }) => {
      setGitBranch(info.branch);
      setGitChangedFiles(info.changedFiles);
    }).catch(() => {
      setGitBranch('');
      setGitChangedFiles(0);
    });
  }, [activeSessionId, activeSession?.workspacePath]);

  useEffect(() => {
    const handler = () => handleNewChat();
    window.addEventListener('mimo:new-chat', handler);
    return () => window.removeEventListener('mimo:new-chat', handler);
  }, [handleNewChat]);

  const handleSwitchSession = async (id: string) => {
    setActiveSession(id);
    switchSession(id);
    onOpenView('chat');
    await window.api.session.switch(id);
  };

  const handleSelectFolder = async () => {
    if (!activeSession) return;
    const workspace = await window.api.workspace.select();
    if (!workspace) return;
    const updated = await window.api.session.setWorkspace(activeSession.id, workspace.path);
    setSessionWorkspace(activeSession.id, workspace);
    if (updated) {
      setSessions(sessions.map((session) => (session.id === updated.id ? updated : session)));
    }
  };

  return (
    <aside className="codex-sidebar">
      <div className="codex-sidebar-main">
        {/* Header */}
        <div className="codex-sidebar-header">
          <span className="codex-sidebar-title">MimoAgent</span>
          <span className="codex-version-badge">AI Coding Workspace</span>
        </div>

        {/* Nav */}
        <nav className="codex-nav">
          <button onClick={handleNewChat} className="codex-nav-row new-chat-btn" type="button">
            <Plus size={16} strokeWidth={2} />
            <span>{t('sidebar.newSession')}</span>
          </button>
          <button
            className={`codex-nav-row ${searchOpen ? 'active' : ''}`}
            type="button"
            onClick={() => {
              setSearchOpen(prev => !prev);
              if (searchOpen) setSearchQuery('');
            }}
          >
            <Search size={16} strokeWidth={1.7} />
            <span>{t('sidebar.search')}</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'plugins' ? 'active' : ''}`} type="button" onClick={() => onOpenView('plugins')}>
            <Sparkles size={16} strokeWidth={1.7} />
            <span>{t('sidebar.plugins')}</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'tts' ? 'active' : ''}`} type="button" onClick={() => onOpenView('tts')}>
            <Volume2 size={16} strokeWidth={1.7} />
            <span>{t('sidebar.tts')}</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'automation' ? 'active' : ''}`} type="button" onClick={() => onOpenView('automation')}>
            <Clock3 size={16} strokeWidth={1.7} />
            <span>{t('sidebar.automation')}</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'skills' ? 'active' : ''}`} type="button" onClick={() => onOpenView('skills')}>
            <Zap size={16} strokeWidth={1.7} />
            <span>{t('sidebar.skills') || '智能技能'}</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'console' ? 'active' : ''}`} type="button" onClick={() => onOpenView('console')}>
            <Terminal size={16} strokeWidth={1.7} />
            <span>{t('sidebar.console') || '控制台'}</span>
          </button>
          {/* Collaboration is now shown inline below in AgentCollabSidebar */}
          <button className={`codex-nav-row ${currentView === 'supervisor' ? 'active' : ''}`} type="button" onClick={() => onOpenView('supervisor')}>
            <Shield size={16} strokeWidth={1.7} />
            <span>{t('sidebar.supervisor') || '督导'}</span>
          </button>
        </nav>

        {/* Conversations */}
        <div className="codex-section codex-conversations-section flex-1 min-h-0 overflow-y-auto">
          {searchOpen ? (
            <div style={{ padding: '0 0 8px' }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }
                }}
                placeholder={t('sidebar.searchPlaceholder')}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <div className="codex-section-title">{t('sidebar.conversations')}</div>
          )}
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingSessionId === session.id;
            return (
              <button
                key={session.id}
                onClick={() => !isEditing && handleSwitchSession(session.id)}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => setHoveredSession(null)}
                className={`codex-conversation-row ${isActive ? 'active' : ''}`}
                type="button"
                title={session.workspacePath || undefined}
              >
                <MessageSquare size={16} strokeWidth={1.7} />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--accent)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <>
                      <div className="truncate">{session.name}</div>
                      <div className="codex-row-subtitle truncate">{session.workspaceName || basename(session.workspacePath)}</div>
                    </>
                  )}
                </div>
                {!isEditing && hoveredSession === session.id && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Edit3
                      size={12}
                      strokeWidth={1.5}
                      className="session-edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(session.id, session.name);
                      }}
                    />
                    {sessions.length > 1 && session.id !== 'default' && (
                      <X
                        size={12}
                        strokeWidth={1.5}
                        className="session-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t('sidebar.confirmDelete', { name: session.name }))) {
                            removeSession(session.id);
                            window.api?.session.delete(session.id);
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* Footer */}
      <div className="codex-footer">
        <div className="codex-footer-project">
          <div className="codex-section-title">{t('sidebar.project')}</div>
          <button className="codex-project-row" onClick={handleSelectFolder} type="button" title={activeSession?.workspacePath}>
            <Folder size={16} strokeWidth={1.7} />
            <div className="min-w-0 flex-1">
              <div className="truncate">{activeSession?.workspaceName || basename(activeSession?.workspacePath)}</div>
              <div className="codex-row-subtitle truncate">{t('sidebar.boundToSession')}</div>
            </div>
          </button>
          {gitBranch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              <GitBranch size={13} strokeWidth={1.7} />
              <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{gitBranch}</span>
              {gitChangedFiles > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--warning, #f59e0b)', color: 'rgba(0,0,0,0.8)', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                  {gitChangedFiles}
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={onOpenWorkspace} className={`codex-nav-row ${currentView === 'workspace' ? 'active' : ''}`} type="button">
          <FolderOpen size={16} strokeWidth={1.7} />
          <span>{t('sidebar.fileBrowser')}</span>
        </button>
        <button onClick={onOpenSettings} className="codex-nav-row" type="button">
          <Settings size={16} strokeWidth={1.7} />
          <span>{t('sidebar.settings')}</span>
        </button>
        <div className="codex-agent-pill">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span className="font-mono text-xs">{model}</span>
        </div>
      </div>
    </aside>
  );
}
