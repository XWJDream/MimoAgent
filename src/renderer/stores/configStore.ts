import { create } from 'zustand';
import type { AppConfig, PublicAppConfig } from '@shared/types';

interface ConfigState {
  config: PublicAppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  loadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: {
    model: 'mimo-v2.5-pro',
    apiBase: 'https://token-plan-cn.xiaomimimo.com/v1',
    apiKeyConfigured: false,
    apiKeyPreview: null,
    permissionMode: 'suggest',
    maxTurns: 50,
    temperature: 0.2,
    theme: 'dark',
    selectedAvatarId: 'default',
    sandboxEnabled: false,
  },
  setConfig: (partial) => {
    const { apiKey, ...publicPartial } = partial;
    set((state) => ({
      config: {
        ...state.config,
        ...publicPartial,
        ...(typeof apiKey === 'string'
          ? {
              apiKeyConfigured: apiKey.length > 0,
              apiKeyPreview: apiKey.length > 8 ? `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}` : apiKey.length > 0 ? '••••' : null,
            }
          : {}),
      },
    }));
    if (window.api?.config) {
      const entries = Object.entries(partial);
      // Send all config updates, then trigger a single reinitialize via the last one
      Promise.all(entries.map(([key, value]) =>
        window.api.config.set(key, value).catch((error: Error) => {
          console.error(`Failed to save config ${key}:`, error);
        })
      ));
    }
  },
  loadConfig: async () => {
    const remoteConfig = await window.api?.config?.get();
    if (remoteConfig) {
      set({ config: remoteConfig });
    }
  },
}));
