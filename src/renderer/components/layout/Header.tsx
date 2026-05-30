import React from 'react';
import { Minus, PanelLeft, Square, X, Search, Settings } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

export function Header({ onToggleSidebar, onOpenSettings }: HeaderProps) {
  const { sessions, activeSessionId } = useSessionStore();
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  function basename(path?: string) {
    if (!path) return null;
    const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized.split('/').pop() || normalized;
  }

  const projectName = activeSession?.workspaceName || basename(activeSession?.workspacePath);

  return (
    <header className="drag-region app-titlebar">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onToggleSidebar} title="切换侧边栏" aria-label="切换侧边栏" className="no-drag icon-button">
          <PanelLeft size={16} strokeWidth={1.7} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {activeSession?.name || 'MimoAgent'}
          </span>
          {projectName && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {projectName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 no-drag">
        <button className="icon-button" title="搜索" aria-label="搜索">
          <Search size={15} strokeWidth={1.7} />
        </button>
        <button onClick={onOpenSettings} className="icon-button" title="设置" aria-label="设置">
          <Settings size={15} strokeWidth={1.7} />
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
        <button onClick={() => window.api?.window.minimize()} title="最小化" aria-label="最小化" className="icon-button">
          <Minus size={14} strokeWidth={1.7} />
        </button>
        <button onClick={() => window.api?.window.maximize()} title="最大化" aria-label="最大化" className="icon-button">
          <Square size={11} strokeWidth={1.7} />
        </button>
        <button onClick={() => window.api?.window.close()} title="关闭" aria-label="关闭" className="icon-button danger">
          <X size={14} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}
