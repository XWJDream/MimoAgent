import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ChatPanel } from '../chat/ChatPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { WorkspacePanel } from '../workspace/WorkspacePanel';
import { PluginPanel } from '../plugins/PluginPanel';
import { AutomationPanel } from '../automation/AutomationPanel';
import { TtsPanel } from '../tts/TtsPanel';
import { SkillPanel } from '../skills/SkillPanel';
import { ConsolePanel } from '../console/ConsolePanel';
import { SupervisorPanel } from '../supervisor/SupervisorPanel';
import { CommandPalette } from '../common/CommandPalette';
import { useChatStore } from '../../stores/chatStore';

type ViewMode = 'chat' | 'workspace' | 'plugins' | 'automation' | 'tts' | 'skills' | 'console' | 'supervisor';

const VIEW_KEYS: Record<string, ViewMode> = {
  '1': 'chat',
  '2': 'workspace',
  '3': 'plugins',
  '4': 'automation',
  '5': 'tts',
  '6': 'skills',
  '7': 'console',
  '8': 'supervisor',
};

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<ViewMode>('chat');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mountedRef = useRef<Record<ViewMode, boolean>>({
    chat: true, workspace: false, plugins: false, automation: false, tts: false, skills: false, console: false, supervisor: false,
  });
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

      // Ctrl+1~5 — switch panels
      if ((e.ctrlKey || e.metaKey) && VIEW_KEYS[e.key]) {
        e.preventDefault();
        const view = VIEW_KEYS[e.key];
        mountedRef.current[view] = true;
        setCurrentView(view);
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
              onOpenWorkspace={() => {
                if (currentView === 'workspace') {
                  setCurrentView('chat');
                } else {
                  mountedRef.current.workspace = true;
                  setCurrentView('workspace');
                }
              }}
              onOpenView={(view) => { mountedRef.current[view] = true; setCurrentView(view); }}
              currentView={currentView}
            />
          </>
        )}

        <div
          className="flex flex-col min-h-0 flex-1 overflow-hidden"
          style={{ display: currentView === 'workspace' ? undefined : 'none' }}
        >
          {mountedRef.current.workspace && <WorkspacePanel mode="files" onClose={() => setCurrentView('chat')} />}
        </div>
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'plugins' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.plugins && <PluginPanel onClose={() => setCurrentView('chat')} />}
        </div>
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'automation' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.automation && <AutomationPanel onClose={() => setCurrentView('chat')} />}
        </div>
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'tts' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.tts && <TtsPanel onClose={() => setCurrentView('chat')} />}
        </div>
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'skills' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.skills && <SkillPanel />}
        </div>
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'console' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.console && <ConsolePanel />}
        </div>
        {/* Collaboration is now shown in the sidebar as AgentCollabSidebar */}
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'supervisor' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.supervisor && <SupervisorPanel />}
        </div>
        <main
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
          style={{ display: currentView === 'chat' ? undefined : 'none' }}
        >
          <ChatPanel />
        </main>
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
        onOpenWorkspace={() => { mountedRef.current.workspace = true; setCurrentView('workspace'); }}
        onOpenView={(view) => { mountedRef.current[view] = true; setCurrentView(view); }}
        sidebarOpen={sidebarOpen}
      />
    </div>
  );
}
