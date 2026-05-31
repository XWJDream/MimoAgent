import type { MimoConfig } from './types.js';

export function getDefaultConfig(): MimoConfig {
  return {
    model: 'mimo-v2.5-pro',
    apiBase: 'https://api.xiaomimimo.com/v1',
    apiKey: process.env.MIMO_API_KEY || '',
    maxTokens: 4096,
    temperature: 0.2,
    contextWindow: 128000,
    permissionMode: 'suggest',
    allowedTools: [],
    blockedTools: [],
    allowedPaths: ['.'],
    maxTurns: 50,
    disableDefaultTools: [],
    sandbox: {
      enabled: false,
      image: 'mimo-agent-sandbox:latest',
      memoryLimit: '512m',
      cpuLimit: 1024,
      networkEnabled: false,
      timeout: 30000,
    },
    theme: 'dark',
    stream: true,
    verbose: false,
    subAgents: {
      enabled: true,
      maxConcurrent: 3,
    },
  };
}
