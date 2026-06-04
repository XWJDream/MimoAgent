import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
  BrowserWindow: class {},
}));

const { buildAgentConfig } = await import('./agent-service.js');

const baseConfig = {
  apiKey: '',
  apiBase: 'https://api.example.test/v1',
  model: 'mimo-v2.5-pro',
  permissionMode: 'suggest' as const,
  toolPreset: 'act' as const,
  maxTurns: 50,
  temperature: 0.2,
  reasoningEffort: 'medium' as const,
  sandboxEnabled: false,
};

describe('buildAgentConfig', () => {
  it('enables sub-agents for act mode', () => {
    const config = buildAgentConfig(baseConfig);

    expect(config.toolPreset).toBe('act');
    expect(config.subAgents).toEqual({ enabled: true, maxConcurrent: 3 });
  });

  it('disables sub-agents for plan mode', () => {
    const config = buildAgentConfig({ ...baseConfig, toolPreset: 'plan' });

    expect(config.toolPreset).toBe('plan');
    expect(config.subAgents.enabled).toBe(false);
  });
});
