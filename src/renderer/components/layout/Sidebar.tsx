import React, { useEffect, useRef, useState } from 'react';
import { Folder, FolderOpen, GitBranch, MessageSquare, Plus, Search, Settings, Sparkles, Clock3, X, Volume2 } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useConfigStore } from '../../stores/configStore';

interface SidebarProps {
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
  onOpenView: (view: 'chat' | 'workspace' | 'plugins' | 'automation' | 'tts') => void;
  currentView: string;
}

function basename(path?: string) {
  if (!path) return '未选择项目';
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
  return normalized.split('/').pop() || normalized;
}

export function Sidebar({ onOpenSettings, onOpenWorkspace, onOpenView, currentView }: SidebarProps) {
  const { sessions, activeSessionId, setSessions, setActiveSession, addSession, removeSession, setSessionWorkspace } = useSessionStore();
  const clearMessages = useChatStore((s) => s.clearMessages);
  const model = useConfigStore((s) => s.config.model);
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0];
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [gitBranch, setGitBranch] = useState<string>('');
  const [gitChangedFiles, setGitChangedFiles] = useState<number>(0);

  const filteredSessions = searchQuery.trim()
    ? sessions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const handleNewChat = async () => {
    const workspace = await window.api.workspace.select();
    if (!workspace) return;
    const session = await window.api.session.create(`会话 ${sessions.length + 1}`, workspace.path);
    addSession(session);
    setActiveSession(session.id);
    clearMessages();
  };

  useEffect(() => {
    window.api.session.list().then((remoteSessions) => {
      if (remoteSessions.length > 0) setSessions(remoteSessions);
    }).catch(console.error);
  }, [setSessions]);

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
    clearMessages();
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
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <div className="codex-sidebar-header">
          <span className="codex-sidebar-title">MimoAgent</span>
          <span className="codex-version-badge">AI Coding Workspace</span>
        </div>

        {/* Nav */}
        <nav className="codex-nav">
          <button onClick={handleNewChat} className="codex-nav-row new-chat-btn" type="button">
            <Plus size={16} strokeWidth={2} />
            <span>新建会话</span>
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
            <span>搜索</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'plugins' ? 'active' : ''}`} type="button" onClick={() => onOpenView('plugins')}>
            <Sparkles size={16} strokeWidth={1.7} />
            <span>插件</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'tts' ? 'active' : ''}`} type="button" onClick={() => onOpenView('tts')}>
            <Volume2 size={16} strokeWidth={1.7} />
            <span>TTS</span>
          </button>
          <button className={`codex-nav-row ${currentView === 'automation' ? 'active' : ''}`} type="button" onClick={() => onOpenView('automation')}>
            <Clock3 size={16} strokeWidth={1.7} />
            <span>自动化</span>
          </button>
        </nav>

        {/* Project */}
        <div className="codex-section">
          <div className="codex-section-title">项目</div>
          <button className="codex-project-row" onClick={handleSelectFolder} type="button" title={activeSession?.workspacePath}>
            <Folder size={16} strokeWidth={1.7} />
            <div className="min-w-0 flex-1">
              <div className="truncate">{activeSession?.workspaceName || basename(activeSession?.workspacePath)}</div>
              <div className="codex-row-subtitle truncate">绑定到当前会话</div>
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

        {/* Conversations */}
        <div className="codex-section flex-1 min-h-0 overflow-y-auto">
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
                placeholder="搜索会话..."
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
            <div className="codex-section-title">对话</div>
          )}
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => handleSwitchSession(session.id)}
                onMouseEnter={() => setHoveredSession(session.id)}
                onMouseLeave={() => setHoveredSession(null)}
                className={`codex-conversation-row ${isActive ? 'active' : ''}`}
                type="button"
                title={session.workspacePath || undefined}
              >
                <MessageSquare size={16} strokeWidth={1.7} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{session.name}</div>
                  <div className="codex-row-subtitle truncate">{session.workspaceName || basename(session.workspacePath)}</div>
                </div>
                {sessions.length > 1 && hoveredSession === session.id && (
                  <X
                    size={12}
                    strokeWidth={1.5}
                    className="session-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确认删除会话「${session.name}」？`)) {
                        removeSession(session.id);
                        window.api?.session.delete(session.id);
                      }
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="codex-footer">
        <button onClick={onOpenWorkspace} className="codex-nav-row" type="button">
          <FolderOpen size={16} strokeWidth={1.7} />
          <span>文件浏览</span>
        </button>
        <button onClick={onOpenSettings} className="codex-nav-row" type="button">
          <Settings size={16} strokeWidth={1.7} />
          <span>设置</span>
        </button>
        <div className="codex-agent-pill">
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span className="font-mono text-xs">{model}</span>
        </div>
      </div>
    </aside>
  );
}
