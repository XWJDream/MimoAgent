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
import { ToastContainer } from '../common/Toast';
import { useChatStore } from '../../stores/chatStore';
import { useCommandStore } from '../../stores/commandStore';
import { SakuraDecorations } from '../theme/SakuraDecorations';
import { PermissionDialog, type PermissionRequest } from '../permissions/PermissionDialog';

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
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const mountedRef = useRef<Record<ViewMode, boolean>>({
    chat: true, workspace: false, plugins: false, automation: false, tts: false, skills: false, console: false, supervisor: false,
  });
  const clearMessages = useChatStore((s) => s.clearMessages);
  const compactMessages = useChatStore((s) => s.compactMessages);

  // Register built-in slash commands
  useEffect(() => {
    const { register } = useCommandStore.getState();

    register({
      id: 'compact',
      trigger: '/compact',
      title: '压缩上下文',
      description: '压缩当前会话上下文以释放 token',
      category: '内置',
      keybind: 'Ctrl+Shift+C',
      action: () => {
        compactMessages();
      },
    });

    register({
      id: 'clear',
      trigger: '/clear',
      title: '清空聊天',
      description: '清空当前会话的所有消息',
      category: '内置',
      keybind: 'Ctrl+L',
      action: () => {
        clearMessages();
      },
    });

    register({
      id: 'model',
      trigger: '/model',
      title: '切换模型',
      description: '切换 AI 模型',
      category: '设置',
      action: () => {
        // Open model selector - dispatch event to open settings
        window.dispatchEvent(new CustomEvent('mimo:open-view', { detail: 'settings' }));
      },
    });

    register({
      id: 'memory',
      trigger: '/memory',
      title: '搜索记忆',
      description: '搜索项目记忆',
      category: '工具',
      action: () => {
        // Open memory search - dispatch event to open workspace
        window.dispatchEvent(new CustomEvent('mimo:open-view', { detail: 'workspace' }));
      },
    });

    register({
      id: 'task',
      trigger: '/task',
      title: '任务管理',
      description: '查看和管理任务',
      category: '工具',
      action: () => {
        // Switch to task panel - dispatch event to open skills
        window.dispatchEvent(new CustomEvent('mimo:open-view', { detail: 'skills' }));
      },
    });

    register({
      id: 'help',
      trigger: '/help',
      title: '帮助',
      description: '显示所有可用命令',
      category: '内置',
      action: () => {
        // Show help - dispatch event to open console
        window.dispatchEvent(new CustomEvent('mimo:open-view', { detail: 'console' }));
      },
    });

    register({
      id: 'plan',
      trigger: '/plan',
      title: '计划模式',
      description: '切换计划模式',
      category: '设置',
      action: () => {
        // Toggle plan mode - dispatch custom event
        window.dispatchEvent(new CustomEvent('mimo:toggle-plan'));
      },
    });

    register({
      id: 'voice',
      trigger: '/voice',
      title: '语音输入',
      description: '开始或停止语音输入',
      category: '工具',
      action: () => {
        // Toggle voice input - dispatch custom event
        window.dispatchEvent(new CustomEvent('mimo:toggle-voice'));
      },
    });
  }, [clearMessages]);

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

  useEffect(() => {
    const handleOpenView = (event: Event) => {
      const view = (event as CustomEvent<ViewMode>).detail;
      if (!view || !(view in mountedRef.current)) return;
      mountedRef.current[view] = true;
      setCurrentView(view);
    };
    window.addEventListener('mimo:open-view', handleOpenView);
    return () => window.removeEventListener('mimo:open-view', handleOpenView);
  }, []);

  // Listen for permission requests from the main process
  useEffect(() => {
    const api = (window as unknown as { api?: { permission?: { onRequest?: (cb: (request: PermissionRequest) => void) => () => void } } }).api;
    if (!api?.permission?.onRequest) return;

    const unsubscribe = api.permission.onRequest((request: PermissionRequest) => {
      setPermissionRequest(request);
    });

    return unsubscribe;
  }, []);

  const handlePermissionAllow = useCallback(
    (always: boolean) => {
      if (!permissionRequest) return;
      const api = (window as unknown as { api?: { permission?: { respond?: (id: string, response: { allowed: boolean; always?: boolean }) => void } } }).api;
      api?.permission?.respond?.(permissionRequest.id, { allowed: true, always });
      setPermissionRequest(null);
    },
    [permissionRequest],
  );

  const handlePermissionReject = useCallback(
    (feedback?: string) => {
      if (!permissionRequest) return;
      const api = (window as unknown as { api?: { permission?: { respond?: (id: string, response: { allowed: boolean; always?: boolean; feedback?: string }) => void } } }).api;
      api?.permission?.respond?.(permissionRequest.id, { allowed: false, always: false, feedback });
      setPermissionRequest(null);
    },
    [permissionRequest],
  );

  return (
    <div className="app-frame overflow-hidden">
      <SakuraDecorations />
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
          {mountedRef.current.skills && <SkillPanel onClose={() => setCurrentView('chat')} />}
        </div>
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'console' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.console && <ConsolePanel onClose={() => setCurrentView('chat')} />}
        </div>
        {/* Collaboration is now shown in the sidebar as AgentCollabSidebar */}
        <div
          className="flex-1 overflow-auto"
          style={{ display: currentView === 'supervisor' ? undefined : 'none', background: 'var(--bg-workspace)' }}
        >
          {mountedRef.current.supervisor && <SupervisorPanel onClose={() => setCurrentView('chat')} />}
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

      {/* Permission Dialog - blocks interaction when active */}
      {permissionRequest && (
        <PermissionDialog
          request={permissionRequest}
          onAllow={handlePermissionAllow}
          onReject={handlePermissionReject}
        />
      )}

      <ToastContainer />
    </div>
  );
}
