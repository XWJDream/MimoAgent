import React from 'react';
import { Minus, PanelLeft, Square, X, Search, Settings } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useT } from '../../i18n';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

export function Header({ onToggleSidebar, onOpenSettings }: HeaderProps) {
  const t = useT();
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
        <button onClick={onToggleSidebar} title={t('header.toggleSidebar')} aria-label={t('header.toggleSidebar')} className="no-drag icon-button">
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
        <button className="icon-button" title={t('header.search')} aria-label={t('header.search')}>
          <Search size={15} strokeWidth={1.7} />
        </button>
        <button onClick={onOpenSettings} className="icon-button" title={t('header.settings')} aria-label={t('header.settings')}>
          <Settings size={15} strokeWidth={1.7} />
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 4px' }} />
        <button onClick={() => window.api?.window.minimize()} title={t('header.minimize')} aria-label={t('header.minimize')} className="icon-button">
          <Minus size={14} strokeWidth={1.7} />
        </button>
        <button onClick={() => window.api?.window.maximize()} title={t('header.maximize')} aria-label={t('header.maximize')} className="icon-button">
          <Square size={11} strokeWidth={1.7} />
        </button>
        <button onClick={() => window.api?.window.close()} title={t('header.close')} aria-label={t('header.close')} className="icon-button danger">
          <X size={14} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}
