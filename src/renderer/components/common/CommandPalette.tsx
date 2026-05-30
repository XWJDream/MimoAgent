import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MessageSquarePlus,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Cpu,
  Database,
  FolderSearch,
  Keyboard,
  Search,
  Sparkles,
  Volume2,
  Clock3,
} from 'lucide-react';

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
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = useMemo(
    () => [
      {
        id: 'new-chat',
        label: '新建对话',
        shortcut: 'Ctrl+N',
        icon: <MessageSquarePlus size={16} strokeWidth={1.7} />,
        action: () => { onNewChat(); onClose(); },
      },
      {
        id: 'toggle-sidebar',
        label: sidebarOpen ? '隐藏侧边栏' : '显示侧边栏',
        shortcut: 'Ctrl+B',
        icon: sidebarOpen ? <PanelLeftClose size={16} strokeWidth={1.7} /> : <PanelLeft size={16} strokeWidth={1.7} />,
        action: () => { onToggleSidebar(); onClose(); },
      },
      {
        id: 'settings',
        label: '打开设置',
        shortcut: 'Ctrl+,',
        icon: <Settings size={16} strokeWidth={1.7} />,
        action: () => { onOpenSettings(); onClose(); },
      },
      {
        id: 'clear-chat',
        label: '清空当前对话',
        shortcut: 'Ctrl+L',
        icon: <Trash2 size={16} strokeWidth={1.7} />,
        action: () => { onClearChat(); onClose(); },
      },
      {
        id: 'workspace',
        label: '打开文件浏览',
        icon: <FolderSearch size={16} strokeWidth={1.7} />,
        action: () => { onOpenWorkspace(); onClose(); },
      },
      {
        id: 'compact',
        label: '压缩对话历史',
        icon: <Database size={16} strokeWidth={1.7} />,
        action: () => {
          window.api?.conversation.compact();
          onClose();
        },
      },
      {
        id: 'search',
        label: '搜索项目文件',
        icon: <Search size={16} strokeWidth={1.7} />,
        action: () => { onOpenWorkspace(); onClose(); },
      },
      {
        id: 'plugins',
        label: '打开插件管理',
        icon: <Sparkles size={16} strokeWidth={1.7} />,
        action: () => { onOpenView('plugins'); onClose(); },
      },
      {
        id: 'tts',
        label: '打开 TTS 语音合成',
        icon: <Volume2 size={16} strokeWidth={1.7} />,
        action: () => { onOpenView('tts'); onClose(); },
      },
      {
        id: 'automation',
        label: '打开自动化规则',
        icon: <Clock3 size={16} strokeWidth={1.7} />,
        action: () => { onOpenView('automation'); onClose(); },
      },
    ],
    [onNewChat, onToggleSidebar, onOpenSettings, onClearChat, onOpenWorkspace, onOpenView, sidebarOpen, onClose],
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
          placeholder="输入命令..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="command-palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
              没有匹配的命令
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
