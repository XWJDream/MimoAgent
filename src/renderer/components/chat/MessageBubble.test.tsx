import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import type { Message, UsageStats } from '@shared/types';

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
});

const baseMessage: Message = {
  id: 'msg-1',
  role: 'user',
  content: 'Hello agent',
  timestamp: Date.now(),
};

describe('MessageBubble - user message', () => {
  it('renders user message content as plain text', () => {
    render(<MessageBubble message={baseMessage} />);

    expect(screen.getByText('Hello agent')).toBeInTheDocument();
  });

  it('renders user message row with user class', () => {
    const { container } = render(<MessageBubble message={baseMessage} />);

    const row = container.querySelector('.message-row.user');
    expect(row).toBeInTheDocument();
  });
});

describe('MessageBubble - assistant message', () => {
  it('renders assistant message content via markdown', () => {
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'This is a response',
      timestamp: Date.now(),
    };

    render(<MessageBubble message={msg} />);

    expect(screen.getByText('This is a response')).toBeInTheDocument();
  });

  it('renders MimoAgent label', () => {
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'response',
      timestamp: Date.now(),
    };

    render(<MessageBubble message={msg} />);

    expect(screen.getByText('MimoAgent')).toBeInTheDocument();
  });

  it('renders token usage when present', () => {
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'response',
      timestamp: Date.now(),
      usage: { tokens: 1500, cost: 0.03 },
    };

    render(<MessageBubble message={msg} />);

    expect(screen.getByText(/1,500 tokens/)).toBeInTheDocument();
  });

  it('renders cached token info when present', () => {
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'response',
      timestamp: Date.now(),
      usage: { tokens: 1000, cost: 0.02, cachedTokens: 400 },
    };

    render(<MessageBubble message={msg} />);

    expect(screen.getByText(/400/)).toBeInTheDocument();
  });

  it('renders markdown bold text', () => {
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: '**bold text**',
      timestamp: Date.now(),
    };

    const { container } = render(<MessageBubble message={msg} />);

    const bold = container.querySelector('strong');
    expect(bold).toBeInTheDocument();
    expect(bold!.textContent).toBe('bold text');
  });

  it('renders markdown code blocks', () => {
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: '```js\nconst x = 1;\n```',
      timestamp: Date.now(),
    };

    const { container } = render(<MessageBubble message={msg} />);

    const code = container.querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code!.textContent).toContain('const x = 1');
  });
});

describe('MessageBubble - system message', () => {
  it('renders system message content', () => {
    const msg: Message = {
      id: 'msg-3',
      role: 'system',
      content: 'System notification',
      timestamp: Date.now(),
    };

    render(<MessageBubble message={msg} />);

    expect(screen.getByText('System notification')).toBeInTheDocument();
  });
});

describe('MessageBubble - tool message', () => {
  it('renders tool result in a pre block', () => {
    const msg: Message = {
      id: 'msg-4',
      role: 'tool',
      content: 'file contents here',
      timestamp: Date.now(),
    };

    const { container } = render(<MessageBubble message={msg} />);

    const pre = container.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre!.textContent).toBe('file contents here');
  });

  it('renders tool result label', () => {
    const msg: Message = {
      id: 'msg-4',
      role: 'tool',
      content: 'output',
      timestamp: Date.now(),
    };

    render(<MessageBubble message={msg} />);

    // The i18n key 'chat.toolResult' maps to '工具结果' in Chinese
    expect(screen.getByText('工具结果')).toBeInTheDocument();
  });
});

describe('MessageBubble - streaming', () => {
  it('renders streaming caret when streaming', () => {
    const msg: Message = {
      id: 'msg-5',
      role: 'assistant',
      content: 'partial',
      timestamp: Date.now(),
    };

    const { container } = render(<MessageBubble message={msg} isStreaming />);

    const caret = container.querySelector('.stream-caret');
    expect(caret).toBeInTheDocument();
  });
});
