import React, { useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useT } from '../../i18n';

const permissionI18nKeys: Record<string, string> = {
  suggest: 'permission.suggest',
  'auto-edit': 'permission.autoEdit',
  'full-auto': 'permission.fullAuto',
};

const toolPresetI18nKeys: Record<string, string> = {
  plan: 'toolPreset.plan',
  act: 'toolPreset.act',
};

export function StatusBar() {
  const t = useT();
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
    ? t('status.noApiKey')
    : apiStatus === 'checking'
      ? t('status.checkingApi')
      : apiStatus === 'invalid'
        ? t('status.apiError', { error: apiError || t('status.connectionFailed') })
        : hasRunningTool
          ? t('status.runningTool')
          : isThinking
            ? t('status.thinking')
            : isStreaming
              ? t('status.streaming')
              : t('status.ready');

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
        <span>{t('status.messages', { count: messages.length })}</span>
        <span>{t('status.tokens', { count: usage.sessionTokens.toLocaleString() })}</span>
        {usage.sessionCachedTokens > 0 && (
          <span style={{ color: 'var(--success)' }}>{t('status.cached', { count: usage.sessionCachedTokens.toLocaleString() })}</span>
        )}
        <span>{t('status.toolCalls', { count: usage.sessionToolCalls })}</span>
      </div>
      <div className="flex items-center gap-3">
        <span>{permissionI18nKeys[config.permissionMode] ? t(permissionI18nKeys[config.permissionMode]) : config.permissionMode}</span>
        {config.toolPreset && config.toolPreset !== 'act' && (
          <span style={{ color: 'var(--warning)' }}>{toolPresetI18nKeys[config.toolPreset] ? t(toolPresetI18nKeys[config.toolPreset]) : config.toolPreset}</span>
        )}
        <span>{config.model}</span>
      </div>
    </div>
  );
}
