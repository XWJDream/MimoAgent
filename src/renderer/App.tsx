import React from 'react';
import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useConfigStore } from './stores/configStore';
import { useSessionStore } from './stores/sessionStore';
import { useChatStore } from './stores/chatStore';

export default function App() {
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const validateApi = useConfigStore((state) => state.validateApi);
  const theme = useConfigStore((state) => state.config.theme);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const loadMessages = useChatStore((state) => state.loadMessages);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  useEffect(() => {
    // Load sessions from disk
    loadSessions().then(() => {
      // Load messages for active session after sessions are loaded
      const { activeSessionId: currentId } = useSessionStore.getState();
      loadMessages(currentId || 'default');
    });
    // Load config and validate API
    loadConfig().then(() => {
      validateApi();
    }).catch((error: Error) => {
      console.error('Failed to load config:', error);
    });
  }, [loadConfig, validateApi, loadSessions, loadMessages]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
