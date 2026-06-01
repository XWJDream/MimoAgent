import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';

const session = {
  id: 's2',
  name: 'Session 2',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  messageCount: 0,
  workspacePath: 'E:/tmp/project',
  workspaceName: 'project',
};

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({
    messages: [{ id: 'm1', role: 'user', content: 'keep?', timestamp: 1 }],
    toolCalls: [{ id: 't1', name: 'read_file', args: {}, status: 'running' }],
    isThinking: true,
    isStreaming: true,
  });
  useSessionStore.setState({
    sessions: [{
      id: 'default',
      name: 'Default',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      messageCount: 1,
    }],
    activeSessionId: 'default',
    loaded: true,
  });
  vi.mocked(window.api.workspace.select).mockResolvedValue({ path: 'E:/tmp/project', name: 'project' });
  vi.mocked(window.api.session.create).mockResolvedValue(session);
});

describe('Sidebar', () => {
  it('clears chat state after creating a new chat', async () => {
    const { container } = render(
      <Sidebar
        currentView="chat"
        onOpenSettings={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenView={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector('.new-chat-btn')!);

    await waitFor(() => expect(useSessionStore.getState().activeSessionId).toBe('s2'));
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().toolCalls).toEqual([]);
    expect(useChatStore.getState().isThinking).toBe(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });
});
