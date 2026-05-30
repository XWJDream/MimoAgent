import React from 'react';
import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useConfigStore } from './stores/configStore';

export default function App() {
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const theme = useConfigStore((state) => state.config.theme);

  useEffect(() => {
    loadConfig().catch((error: Error) => {
      console.error('Failed to load config:', error);
    });
  }, [loadConfig]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  return <AppShell />;
}
