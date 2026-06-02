import { create } from 'zustand';
import type { AppConfig, PublicAppConfig } from '@shared/types';

type ApiStatus = 'unknown' | 'checking' | 'valid' | 'invalid';

interface ConfigState {
  config: PublicAppConfig;
  apiStatus: ApiStatus;
  apiError: string | null;
  setConfig: (config: Partial<AppConfig>) => Promise<void>;
  loadConfig: () => Promise<void>;
  validateApi: () => Promise<void>;
}

// Queue to prevent race conditions in config writes
let configWriteQueue: Promise<void> = Promise.resolve();

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: {
    model: 'mimo-v2.5-pro',
    apiBase: 'https://api.xiaomimimo.com/v1',
    apiKeyConfigured: false,
    apiKeyPreview: null,
    permissionMode: 'suggest',
    toolPreset: 'act',
    maxTurns: 50,
    temperature: 0.2,
    theme: 'dark',
    selectedAvatarId: 'default',
    sandboxEnabled: false,
  },
  apiStatus: 'unknown',
  apiError: null,
  setConfig: async (partial) => {
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
      // Reset validation when key or base changes
      ...(typeof apiKey === 'string' || partial.apiBase ? { apiStatus: 'unknown' as ApiStatus, apiError: null } : {}),
    }));
    if (window.api?.config) {
      // Chain config writes to prevent race conditions
      configWriteQueue = configWriteQueue.then(async () => {
        const entries = Object.entries(partial);
        for (const [key, value] of entries) {
          try {
            await window.api.config.set(key, value);
          } catch (error) {
            console.error(`Failed to save config ${key}:`, error);
          }
        }
      });
      await configWriteQueue;
    }
  },
  loadConfig: async () => {
    const remoteConfig = await window.api?.config?.get();
    if (remoteConfig) {
      set({ config: remoteConfig });
    }
  },
  validateApi: async () => {
    const { config } = get();
    if (!config.apiKeyConfigured) {
      set({ apiStatus: 'invalid', apiError: '未配置 API Key' });
      return;
    }
    set({ apiStatus: 'checking', apiError: null });
    try {
      const res = await window.api?.api?.validate();
      if (res?.valid) {
        set({ apiStatus: 'valid', apiError: null });
      } else {
        set({ apiStatus: 'invalid', apiError: res?.error || '验证失败' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ apiStatus: 'invalid', apiError: msg });
    }
  },
}));
