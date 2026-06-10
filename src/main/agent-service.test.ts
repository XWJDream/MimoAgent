import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
  BrowserWindow: class {},
}));

const { buildAgentConfig, AgentService } = await import('./agent-service.js');

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

  it('maps all config fields correctly', () => {
    const config = buildAgentConfig(baseConfig);

    expect(config.model).toBe('mimo-v2.5-pro');
    expect(config.apiBase).toBe('https://api.example.test/v1');
    expect(config.apiKey).toBe('');
    expect(config.temperature).toBe(0.2);
    expect(config.reasoningEffort).toBe('medium');
    expect(config.permissionMode).toBe('suggest');
    expect(config.maxTurns).toBe(50);
    expect(config.sandbox.enabled).toBe(false);
    expect(config.stream).toBe(true);
  });
});

describe('AgentService', () => {
  it('should have null agent initially', () => {
    const service = new AgentService();
    expect(service.getAgent()).toBeNull();
  });

  it('should not throw when stop() is called on a non-running service', () => {
    const service = new AgentService();
    expect(() => service.stop()).not.toThrow();
  });

  it('should not throw when clear() is called without an agent', () => {
    const service = new AgentService();
    expect(() => service.clear()).not.toThrow();
  });

  it('should accept a BrowserWindow via setMainWindow', () => {
    const service = new AgentService();
    const mockWindow = {} as any;
    expect(() => service.setMainWindow(mockWindow)).not.toThrow();
  });
});
