/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InputArea } from './InputArea';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import type { UsageStats } from '@shared/types';

const emptyUsage: UsageStats = {
  sessionTokens: 0,
  sessionCost: 0,
  sessionToolCalls: 0,
  sessionCachedTokens: 0,
  sessionPromptTokens: 0,
  sessionCompletionTokens: 0,
  totalTokens: 0,
  totalCost: 0,
  totalToolCalls: 0,
  currentPromptTokens: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({
    messages: [],
    isThinking: false,
    isStreaming: false,
    currentResponse: '',
    toolCalls: [],
    activeSessionId: 'default',
    usage: { ...emptyUsage },
  });
  useConfigStore.setState({
    config: {
      model: 'mimo-v2.5-pro',
      apiBase: 'https://api.example.test/v1',
      apiKeyConfigured: true,
      apiKeyPreview: 'sk**test',
      permissionMode: 'suggest',
      toolPreset: 'act',
      maxTurns: 50,
      temperature: 0.2,
      theme: 'dark',
      selectedAvatarId: 'default',
      sandboxEnabled: false,
      reasoningEffort: 'medium',
    },
    apiStatus: 'valid',
    apiError: null,
  });

  // Mock window.api.agent for the component's event listeners
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).api = {
    ...window.api,
    agent: {
      run: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      onToken: vi.fn().mockReturnValue(() => {}),
      onDone: vi.fn().mockReturnValue(() => {}),
      onError: vi.fn().mockReturnValue(() => {}),
      onToolStart: vi.fn().mockReturnValue(() => {}),
      onToolResult: vi.fn().mockReturnValue(() => {}),
      onThinking: vi.fn().mockReturnValue(() => {}),
    },
    files: {
      pickAttachments: vi.fn().mockResolvedValue([]),
    },
  };
});

describe('InputArea', () => {
  it('renders textarea and send button', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();

    const sendButton = screen.getByRole('button', { name: /发送/i });
    expect(sendButton).toBeInTheDocument();
  });

  it('updates textarea value on input', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello world' } });

    expect((textarea as HTMLTextAreaElement).value).toBe('hello world');
  });

  it('disables send button when input is empty', () => {
    render(<InputArea />);

    const sendButton = screen.getByRole('button', { name: /发送/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has non-whitespace text', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });

    const sendButton = screen.getByRole('button', { name: /发送/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('shows stop button when streaming', () => {
    useChatStore.setState({ isStreaming: true });

    render(<InputArea />);

    const stopButton = screen.getByRole('button', { name: /停止/i });
    expect(stopButton).toBeInTheDocument();
  });

  it('calls agent.run on send', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test prompt' } });

    const sendButton = screen.getByRole('button', { name: /发送/i });
    fireEvent.click(sendButton);

    expect(window.api!.agent!.run).toHaveBeenCalledWith('test prompt');
  });

  it('clears input after sending', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('sends on Enter key press', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'key send' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(window.api!.agent!.run).toHaveBeenCalledWith('key send');
  });

  it('does not send on Shift+Enter', () => {
    render(<InputArea />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'no send' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(window.api!.agent!.run).not.toHaveBeenCalled();
  });

  it('calls agent.stop when stop button is clicked', () => {
    useChatStore.setState({ isStreaming: true });

    render(<InputArea />);

    const stopButton = screen.getByRole('button', { name: /停止/i });
    fireEvent.click(stopButton);

    expect(window.api!.agent!.stop).toHaveBeenCalled();
  });

  it('switches the real tool preset from the plus menu', async () => {
    render(<InputArea />);

    fireEvent.click(screen.getByRole('button', { name: '更多功能' }));
    fireEvent.click(screen.getByRole('button', { name: /计划模式/ }));

    await waitFor(() => expect(useConfigStore.getState().config.toolPreset).toBe('plan'));
    expect(screen.getByText('计划模式', { selector: '.composer-mode-indicators span' })).toBeInTheDocument();
  });

  it('adds goal tracking instructions to the agent prompt', () => {
    render(<InputArea />);

    fireEvent.click(screen.getByRole('button', { name: '更多功能' }));
    fireEvent.click(screen.getByRole('button', { name: /追求目标/ }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'finish this task' } });
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(window.api.agent.run).toHaveBeenCalledWith(expect.stringContaining('Goal tracking is enabled'));
  });

  it('picks and sends text attachments with their content', async () => {
    vi.mocked(window.api.files.pickAttachments).mockResolvedValueOnce([{
      name: 'notes.md',
      path: 'C:\\notes.md',
      size: 12,
      kind: 'text',
      content: '# Notes',
    }]);
    render(<InputArea />);

    fireEvent.click(screen.getByRole('button', { name: '更多功能' }));
    fireEvent.click(screen.getByRole('button', { name: '添加照片和文件' }));
    await screen.findByText('notes.md');
    fireEvent.click(screen.getByRole('button', { name: /发送/i }));

    expect(window.api.agent.run).toHaveBeenCalledWith(expect.stringContaining('# Notes'));
  });
});
