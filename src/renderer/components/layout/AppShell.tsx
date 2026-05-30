import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatPanel } from '../chat/ChatPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { WorkspacePanel } from '../workspace/WorkspacePanel';
import { PluginPanel } from '../plugins/PluginPanel';
import { AutomationPanel } from '../automation/AutomationPanel';
import { TtsPanel } from '../tts/TtsPanel';
import { CommandPalette } from '../common/CommandPalette';
import { useChatStore } from '../../stores/chatStore';

type ViewMode = 'chat' | 'workspace' | 'plugins' | 'automation' | 'tts';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewMode>('chat');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const handleNewChat = useCallback(() => {
    clearMessages();
    // Trigger sidebar's new chat via a custom event
    window.dispatchEvent(new CustomEvent('mimo:new-chat'));
  }, [clearMessages]);

  const handleClearChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+N — new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
        return;
      }

      // Ctrl+B — toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
        return;
      }

      // Ctrl+, — settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // Ctrl+L — clear chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        handleClearChat();
        return;
      }

      // Escape — close palette, settings, or panel views
      if (e.key === 'Escape') {
        if (paletteOpen) {
          setPaletteOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else if (currentView !== 'chat') {
          setCurrentView('chat');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paletteOpen, settingsOpen, currentView, handleNewChat, handleClearChat]);

  return (
    <div className="app-frame overflow-hidden">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <>
            <div
              className="sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
            />
            <Sidebar
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenWorkspace={() => setCurrentView('workspace')}
              onOpenView={(view) => setCurrentView(view)}
              currentView={currentView}
            />
          </>
        )}

        {currentView === 'workspace' ? (
          <div className="flex-1 overflow-hidden">
            <WorkspacePanel mode="files" />
          </div>
        ) : currentView === 'plugins' ? (
          <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-workspace)' }}>
            <PluginPanel onClose={() => setCurrentView('chat')} />
          </div>
        ) : currentView === 'automation' ? (
          <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-workspace)' }}>
            <AutomationPanel onClose={() => setCurrentView('chat')} />
          </div>
        ) : currentView === 'tts' ? (
          <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-workspace)' }}>
            <TtsPanel onClose={() => setCurrentView('chat')} />
          </div>
        ) : (
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <ChatPanel />
          </main>
        )}
      </div>

      <StatusBar />
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewChat={handleNewChat}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onOpenSettings={() => setSettingsOpen(true)}
        onClearChat={handleClearChat}
        onOpenWorkspace={() => setCurrentView('workspace')}
        onOpenView={(view) => setCurrentView(view)}
        sidebarOpen={sidebarOpen}
      />
    </div>
  );
}
