import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useChatStore } from '../../stores/chatStore';
import { ToolPanel } from '../tools/ToolPanel';

export function ChatPanel() {
  const { isThinking, isStreaming, toolCalls } = useChatStore();
  const [toolPanelOpen, setToolPanelOpen] = useState(false);
  const runningTools = toolCalls.filter((t) => t.status === 'running').length;

  return (
    <section className="chat-workbench flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-hidden">
          <MessageList />
        </div>
        <ToolPanel forceOpen={toolPanelOpen} />
      </div>
      {(isThinking || isStreaming) && <ThinkingIndicator />}
      <div className="relative">
        <InputArea />
        {toolCalls.length > 0 && (
          <button
            className="xl:hidden"
            onClick={() => setToolPanelOpen((prev) => !prev)}
            style={{
              position: 'absolute', top: -32, right: 12,
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: runningTools > 0 ? 'var(--accent)' : 'var(--text-muted)',
              background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
            }}
            title="切换工具面板"
          >
            <Wrench size={12} />
            {toolCalls.length}
            {runningTools > 0 && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 2s ease-in-out infinite' }} />}
          </button>
        )}
      </div>
    </section>
  );
}
