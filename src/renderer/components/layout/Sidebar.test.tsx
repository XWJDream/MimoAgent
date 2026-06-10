import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  vi.mocked(window.api.session.switch).mockResolvedValue(undefined);
  vi.mocked(window.api.session.list).mockResolvedValue([]);
});

describe('Sidebar', () => {
  it('clears chat state after creating a new chat', async () => {
    const onOpenView = vi.fn();
    const { container } = render(
      <Sidebar
        currentView="chat"
        onOpenSettings={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenView={onOpenView}
      />,
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fireEvent.click(container.querySelector('.new-chat-btn')!);

    await waitFor(() => expect(useSessionStore.getState().activeSessionId).toBe('s2'));
    expect(useChatStore.getState().activeSessionId).toBe('s2');
    expect(useChatStore.getState().messages).toEqual([]);
    expect(useChatStore.getState().toolCalls).toEqual([]);
    expect(useChatStore.getState().isThinking).toBe(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
    expect(onOpenView).toHaveBeenCalledWith('chat');
  });

  it('renders persisted sessions without replacing them from the main-process list', () => {
    useSessionStore.setState({
      sessions: [
        {
          id: 'default',
          name: 'Default',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          messageCount: 1,
        },
        session,
      ],
      activeSessionId: 'default',
      loaded: true,
    });

    render(
      <Sidebar
        currentView="chat"
        onOpenSettings={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenView={vi.fn()}
      />,
    );

    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    expect(window.api.session.list).not.toHaveBeenCalled();
  });

  it('switches sessions and opens the chat view when a session row is clicked', async () => {
    const onOpenView = vi.fn();
    useSessionStore.setState({
      sessions: [
        {
          id: 'default',
          name: 'Default',
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          messageCount: 1,
        },
        session,
      ],
      activeSessionId: 'default',
      loaded: true,
    });

    render(
      <Sidebar
        currentView="automation"
        onOpenSettings={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onOpenView={onOpenView}
      />,
    );

    fireEvent.click(screen.getByText('Session 2'));

    await waitFor(() => expect(useSessionStore.getState().activeSessionId).toBe('s2'));
    expect(window.api.session.switch).toHaveBeenCalledWith('s2');
    expect(onOpenView).toHaveBeenCalledWith('chat');
  });
});
