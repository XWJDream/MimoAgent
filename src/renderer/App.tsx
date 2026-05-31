import React from 'react';
import { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useConfigStore } from './stores/configStore';

export default function App() {
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const validateApi = useConfigStore((state) => state.validateApi);
  const theme = useConfigStore((state) => state.config.theme);
  const apiKeyConfigured = useConfigStore((state) => state.config.apiKeyConfigured);

  useEffect(() => {
    loadConfig().then(() => {
      // Validate API after config loads
      validateApi();
    }).catch((error: Error) => {
      console.error('Failed to load config:', error);
    });
  }, [loadConfig, validateApi]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  return <AppShell />;
}
