import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 0),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: (id: number) => window.clearTimeout(id),
});

Object.defineProperty(window, 'api', {
  writable: true,
  value: {
    messages: {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue({ messages: [] }),
    },
    conversation: {
      compact: vi.fn().mockResolvedValue(undefined),
    },
    workspace: {
      select: vi.fn().mockResolvedValue(null),
    },
    session: {
      create: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      switch: vi.fn().mockResolvedValue(undefined),
      setWorkspace: vi.fn(),
    },
    sessions: {
      save: vi.fn().mockResolvedValue(undefined),
      load: vi.fn().mockResolvedValue({ sessions: [] }),
    },
    git: {
      info: vi.fn().mockResolvedValue({ branch: 'main', changedFiles: 0 }),
    },
  },
});
