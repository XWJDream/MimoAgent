import React from 'react';
import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useConfigStore } from './stores/configStore';
import { useSessionStore } from './stores/sessionStore';

export default function App() {
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const validateApi = useConfigStore((state) => state.validateApi);
  const theme = useConfigStore((state) => state.config.theme);
  const loadSessions = useSessionStore((state) => state.loadSessions);

  useEffect(() => {
    // Load sessions from disk
    loadSessions();
    // Load config and validate API
    loadConfig().then(() => {
      validateApi();
    }).catch((error: Error) => {
      console.error('Failed to load config:', error);
    });
  }, [loadConfig, validateApi, loadSessions]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
