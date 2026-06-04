import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolPanel } from './ToolPanel';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';

beforeEach(() => {
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
  useChatStore.setState({
    messages: [
      { id: 'm1', role: 'user', content: 'hello'.repeat(20), timestamp: 1 },
      { id: 'm2', role: 'assistant', content: 'world'.repeat(20), timestamp: 2 },
    ],
    isThinking: true,
    isStreaming: false,
    currentResponse: '',
    toolCalls: [
      { id: 't1', name: 'read_file', args: {}, status: 'running' },
      { id: 't2', name: 'grep', args: {}, status: 'done', output: 'ok' },
    ],
    usage: {
      sessionTokens: 1000,
      sessionCost: 0.02,
      sessionToolCalls: 2,
      sessionCachedTokens: 250,
      sessionPromptTokens: 600,
      sessionCompletionTokens: 400,
      totalTokens: 1000,
      totalCost: 0.02,
      totalToolCalls: 2,
      currentPromptTokens: 600,
    },
  });
});

describe('ToolPanel', () => {
  it('renders context, cache, and running tool state', () => {
    render(<ToolPanel forceOpen />);

    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('mimo-v2.5-pro')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('read_file')).toBeInTheDocument();
  });
});
