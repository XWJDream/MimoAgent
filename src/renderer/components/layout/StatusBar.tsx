import React, { useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { useSessionStore } from '../../stores/sessionStore';

const permissionLabels: Record<string, string> = {
  suggest: '建议模式',
  'auto-edit': '自动编辑',
  'full-auto': '全自动',
};

const toolPresetLabels: Record<string, string> = {
  plan: '分析模式',
  act: '操作模式',
};

export function StatusBar() {
  const { usage, messages, isThinking, isStreaming, toolCalls } = useChatStore();
  const { config, apiStatus, apiError, validateApi } = useConfigStore();
  const { sessions, activeSessionId } = useSessionStore();
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const hasRunningTool = toolCalls.some((tool) => tool.status === 'running');

  // Validate API on mount and when key/base changes
  useEffect(() => {
    if (config.apiKeyConfigured && apiStatus === 'unknown') {
      validateApi();
    }
  }, [config.apiKeyConfigured, config.apiBase, apiStatus]);

  const statusText = !config.apiKeyConfigured
    ? '未配置 API Key'
    : apiStatus === 'checking'
      ? '正在验证 API…'
      : apiStatus === 'invalid'
        ? `API 异常：${apiError || '连接失败'}`
        : hasRunningTool
          ? '正在执行工具'
          : isThinking
            ? '正在思考'
            : isStreaming
              ? '正在输出'
              : '就绪';

  const statusColor = !config.apiKeyConfigured
    ? 'var(--warning)'
    : apiStatus === 'checking'
      ? 'var(--text-muted)'
      : apiStatus === 'invalid'
        ? 'var(--error)'
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
        {usage.sessionCachedTokens > 0 && (
          <span style={{ color: 'var(--success)' }}>缓存 {usage.sessionCachedTokens.toLocaleString()}</span>
        )}
        <span>{usage.sessionToolCalls} 次工具调用</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{permissionLabels[config.permissionMode] || config.permissionMode}</span>
        {config.toolPreset && config.toolPreset !== 'act' && (
          <span style={{ color: 'var(--warning)' }}>{toolPresetLabels[config.toolPreset] || config.toolPreset}</span>
        )}
        <span>{config.model}</span>
      </div>
    </div>
  );
}
