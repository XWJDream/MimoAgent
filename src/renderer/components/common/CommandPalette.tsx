import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquarePlus,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  // Cpu (removed: unused)
  Database,
  FolderSearch,
  // Keyboard (removed: unused)
  Search,
  Sparkles,
  Volume2,
  Clock3,
} from 'lucide-react';
import { useT } from '../../i18n';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
  onOpenWorkspace: () => void;
  onOpenView: (view: 'plugins' | 'automation' | 'tts') => void;
  sidebarOpen: boolean;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNewChat,
  onToggleSidebar,
  onOpenSettings,
  onClearChat,
  onOpenWorkspace,
  onOpenView,
  sidebarOpen,
}: CommandPaletteProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = useMemo(
    () => [
      {
        id: 'new-chat',
        label: t('command.newConversation'),
        shortcut: 'Ctrl+N',
        icon: <MessageSquarePlus size={16} strokeWidth={1.7} />,
        action: () => { onNewChat(); onClose(); },
      },
      {
        id: 'toggle-sidebar',
        label: sidebarOpen ? t('command.hideSidebar') : t('command.showSidebar'),
        shortcut: 'Ctrl+B',
        icon: sidebarOpen ? <PanelLeftClose size={16} strokeWidth={1.7} /> : <PanelLeft size={16} strokeWidth={1.7} />,
        action: () => { onToggleSidebar(); onClose(); },
      },
      {
        id: 'settings',
        label: t('command.openSettings'),
        shortcut: 'Ctrl+,',
        icon: <Settings size={16} strokeWidth={1.7} />,
        action: () => { onOpenSettings(); onClose(); },
      },
      {
        id: 'clear-chat',
        label: t('command.clearConversation'),
        shortcut: 'Ctrl+L',
        icon: <Trash2 size={16} strokeWidth={1.7} />,
        action: () => { onClearChat(); onClose(); },
      },
      {
        id: 'workspace',
        label: t('command.openFileBrowser'),
        icon: <FolderSearch size={16} strokeWidth={1.7} />,
        action: () => { onOpenWorkspace(); onClose(); },
      },
      {
        id: 'compact',
        label: t('command.compactHistory'),
        icon: <Database size={16} strokeWidth={1.7} />,
        action: () => {
          window.api?.conversation.compact();
          onClose();
        },
      },
      {
        id: 'search',
        label: t('command.searchFiles'),
        icon: <Search size={16} strokeWidth={1.7} />,
        action: () => { onOpenWorkspace(); onClose(); },
      },
      {
        id: 'plugins',
        label: t('command.openPlugins'),
        icon: <Sparkles size={16} strokeWidth={1.7} />,
        action: () => { onOpenView('plugins'); onClose(); },
      },
      {
        id: 'tts',
        label: t('command.openTts'),
        icon: <Volume2 size={16} strokeWidth={1.7} />,
        action: () => { onOpenView('tts'); onClose(); },
      },
      {
        id: 'automation',
        label: t('command.openAutomation'),
        icon: <Clock3 size={16} strokeWidth={1.7} />,
        action: () => { onOpenView('automation'); onClose(); },
      },
    ],
    [t, onNewChat, onToggleSidebar, onOpenSettings, onClearChat, onOpenWorkspace, onOpenView, sidebarOpen, onClose],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) => cmd.label.toLowerCase().includes(lower) || cmd.id.includes(lower),
    );
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('.command-palette-item');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp' && filtered.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        filtered[activeIndex]?.action();
      }
    },
    [filtered, activeIndex, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder={t('command.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="command-palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
              {t('command.noMatch')}
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                className={`command-palette-item ${i === activeIndex ? 'active' : ''}`}
                onClick={cmd.action}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{cmd.icon}</span>
                <span>{cmd.label}</span>
                {cmd.shortcut && <span className="shortcut">{cmd.shortcut}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
