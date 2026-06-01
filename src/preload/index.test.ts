import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  return {
    listeners,
    exposed: null as unknown,
    ipcRenderer: {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
        listeners.set(channel, handler);
      }),
      removeListener: vi.fn(),
    },
    contextBridge: {
      exposeInMainWorld: vi.fn((_name: string, api: unknown) => {
        mocks.exposed = api;
      }),
    },
  };
});

vi.mock('electron', () => ({
  contextBridge: mocks.contextBridge,
  ipcRenderer: mocks.ipcRenderer,
}));

describe('preload api', () => {
  beforeAll(async () => {
    await import('./index.js');
  });

  it('passes cachedTokens through agent.onDone', () => {
    const api = mocks.exposed as {
      agent: {
        onDone: (cb: (usage: { tokens: number; cost: number; cachedTokens?: number }) => void) => () => void;
      };
    };
    const cb = vi.fn();

    api.agent.onDone(cb);
    mocks.listeners.get('agent:done')?.({}, { tokens: 12, cost: 0.01, cachedTokens: 5 });

    expect(cb).toHaveBeenCalledWith({ tokens: 12, cost: 0.01, cachedTokens: 5 });
  });
});
