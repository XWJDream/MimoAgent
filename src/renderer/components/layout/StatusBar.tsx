import React from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { useSessionStore } from '../../stores/sessionStore';

const permissionLabels: Record<string, string> = {
  suggest: '建议模式',
  'auto-edit': '自动编辑',
  'full-auto': '全自动',
};

export function StatusBar() {
  const { usage, messages, isThinking, isStreaming, toolCalls } = useChatStore();
  const { config } = useConfigStore();
  const { sessions, activeSessionId } = useSessionStore();
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const hasRunningTool = toolCalls.some((tool) => tool.status === 'running');
  const statusText = !config.apiKeyConfigured
    ? '未配置 API Key'
    : hasRunningTool
      ? '正在执行工具'
      : isThinking
        ? '正在思考'
        : isStreaming
          ? '正在输出'
          : '就绪';
  const statusColor = !config.apiKeyConfigured
    ? 'var(--warning)'
    : hasRunningTool || isThinking || isStreaming
      ? 'var(--accent)'
      : 'var(--success)';

  return (
    <div className="flex items-center justify-between px-4 text-[10px] select-none"
      style={{ height: 28, background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
          {statusText}
        </span>
        {activeSession && (
          <span style={{ color: 'var(--text-secondary)' }}>{activeSession.name}</span>
        )}
        <span>{messages.length} 条消息</span>
        <span>{usage.sessionTokens.toLocaleString()} tokens</span>
        <span>{usage.sessionToolCalls} 次工具调用</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{permissionLabels[config.permissionMode] || config.permissionMode}</span>
        <span>{config.model}</span>
      </div>
    </div>
  );
}
