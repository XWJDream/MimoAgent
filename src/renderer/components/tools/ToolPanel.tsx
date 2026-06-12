import React, { useEffect, useState } from 'react';
import { Wrench, Activity, Layers, Zap, Users } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { useT } from '../../i18n';

interface ToolPanelProps {
  forceOpen?: boolean;
}

// Pressure level labels and colors
const PRESSURE_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: '无压力', color: 'var(--success)', bg: 'rgba(34,197,94,0.12)' },
  1: { label: '轻度', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  2: { label: '中度', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  3: { label: '严重', color: 'var(--error)', bg: 'rgba(239,68,68,0.12)' },
};

// Model context window sizes
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'mimo-v2.5-pro': 1048576,       // 1M
  'mimo-v2.5': 262144,            // 256k
  'mimo-v2.5-tts': 128000,        // 128k
  'mimo-v2.5-tts-voiceclone': 128000,
  'mimo-v2.5-tts-voicedesign': 128000,
};
const DEFAULT_CONTEXT_WINDOW = 128000;

function getContextWindow(model: string): number {
  return MODEL_CONTEXT_WINDOWS[model] || DEFAULT_CONTEXT_WINDOW;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1048576) return `${(tokens / 1048576).toFixed(0)}M`;
  if (tokens >= 1024) return `${(tokens / 1024).toFixed(0)}k`;
  return tokens.toLocaleString();
}

/** Format token count with K/M suffix (e.g. 110K, 1.2M) */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toLocaleString();
}

export function ToolPanel({ forceOpen }: ToolPanelProps) {
  const t = useT();
  const { toolCalls, usage, messages, isThinking, isStreaming } = useChatStore();
  const { config, apiStatus } = useConfigStore();
  const runningTools = toolCalls.filter((tc) => tc.status === 'running').length;

  // Context pressure state (updated via IPC from engine)
  const [pressureLevel, setPressureLevel] = useState<0 | 1 | 2 | 3>(0);
  const [pressureUsable, setPressureUsable] = useState(0);
  const [pressureCurrent, setPressureCurrent] = useState(0);

  useEffect(() => {
    const api = (window as unknown as { api?: { agent?: { onContextPressure?: (cb: (data: { level: 0 | 1 | 2 | 3; usable: number; current: number }) => void) => () => void } } }).api;
    const unsub = api?.agent?.onContextPressure?.((data) => {
      setPressureLevel(data.level);
      setPressureUsable(data.usable);
      setPressureCurrent(data.current);
    });
    return () => { unsub?.(); };
  }, []);

  const hasRunningTool = toolCalls.some((tc) => tc.status === 'running');
  const agentStatus = !config.apiKeyConfigured
    ? t('inspector.status.notConfigured')
    : apiStatus === 'checking'
      ? t('inspector.status.checking')
      : apiStatus === 'invalid'
        ? t('inspector.status.apiError')
        : hasRunningTool
          ? t('inspector.status.running')
          : isThinking
            ? t('inspector.status.thinking')
            : isStreaming
              ? t('inspector.status.streaming')
              : t('inspector.status.ready');

  const agentStatusColor = !config.apiKeyConfigured
    ? 'var(--warning)'
    : apiStatus === 'invalid'
      ? 'var(--error)'
      : hasRunningTool || isThinking || isStreaming
        ? 'var(--accent)'
        : 'var(--success)';

  // Context usage - use latest turn's promptTokens (not cumulative) for context window display
  const contextWindow = getContextWindow(config.model);
  const estimatedContextFromMessages = messages.reduce((sum, m) => {
    return sum + Math.ceil((m.content?.length || 0) / 3) + 50;
  }, 2000);
  // Use currentPromptTokens (latest turn, overwritten not accumulated) for context window
  const estimatedContextTokens = usage.currentPromptTokens > 0
    ? usage.currentPromptTokens
    : estimatedContextFromMessages;
  const contextPercent = Math.min((estimatedContextTokens / contextWindow) * 100, 100);
  const contextColor = contextPercent > 75 ? 'var(--error)' : contextPercent > 50 ? 'var(--warning)' : 'var(--accent)';


  return (
    <aside
      className={`inspector-panel xl:block ${forceOpen ? 'block' : 'hidden'}`}
    >
      <div className="inspector-header">
        <div className="inspector-title">Inspector</div>
        <div className="inspector-subtitle">{t('inspector.taskStatus')}</div>
      </div>

      {/* Agent Status */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} strokeWidth={1.7} /> {t('inspector.agentStatus')}
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.statusLabel')}</span>
          <span className="inspector-stat-value" style={{ color: agentStatusColor, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: agentStatusColor, display: 'inline-block', ...(isThinking || isStreaming || hasRunningTool ? { animation: 'pulse-dot 2s ease-in-out infinite' } : {}) }} />
            {agentStatus}
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.model')}</span>
          <span className="inspector-stat-value">{config.model}</span>
        </div>
      </div>

      {/* Token Usage */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} strokeWidth={1.7} /> {t('inspector.tokenUsage')}
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.inputTokens')}</span>
          <span className="inspector-stat-value">{formatTokens(usage.sessionPromptTokens)}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.outputTokens')}</span>
          <span className="inspector-stat-value">{formatTokens(usage.sessionCompletionTokens)}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.sessionTotal')}</span>
          <span className="inspector-stat-value" style={{ fontWeight: 600 }}>{formatTokens(usage.sessionTokens)}</span>
        </div>
      </div>


      {/* Context Window */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={12} strokeWidth={1.7} /> {t('inspector.contextWindow')}
            {pressureLevel > 0 && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 600,
                color: PRESSURE_CONFIG[pressureLevel].color,
                background: PRESSURE_CONFIG[pressureLevel].bg,
                padding: '1px 6px',
                borderRadius: 4,
              }}>
                {PRESSURE_CONFIG[pressureLevel].label}
              </span>
            )}
          </span>
        </div>
        <div style={{ padding: '0 0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>{formatTokens(estimatedContextTokens)} / {formatContextWindow(contextWindow)}</span>
            <span style={{ color: contextColor, fontWeight: 600 }}>{contextPercent.toFixed(1)}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${contextPercent}%`,
              height: '100%',
              borderRadius: 3,
              transition: 'width 300ms ease, background 300ms ease',
              background: contextColor,
            }} />
            {/* Pressure zone marker */}
            {pressureLevel > 0 && pressureUsable > 0 && (
              <div style={{
                position: 'absolute',
                left: `${Math.min((pressureCurrent / contextWindow) * 100, 100)}%`,
                top: -2,
                width: 2,
                height: 10,
                background: PRESSURE_CONFIG[pressureLevel].color,
                borderRadius: 1,
                transition: 'left 300ms ease',
              }} />
            )}
          </div>
          {/* Pressure indicator bar */}
          {pressureLevel > 0 && (
            <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
              {[1, 2, 3].map((lvl) => (
                <div key={lvl} style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: pressureLevel >= lvl ? PRESSURE_CONFIG[lvl].color : 'var(--bg-hover)',
                  transition: 'background 300ms ease',
                }} />
              ))}
            </div>
          )}
          {pressureLevel >= 2 && (
            <div style={{ fontSize: 10, color: PRESSURE_CONFIG[pressureLevel].color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              {pressureLevel >= 3 ? '!!' : '!'} 上下文压力{PRESSURE_CONFIG[pressureLevel].label}，自动压缩已触发
            </div>
          )}
          {contextPercent > 75 && pressureLevel < 2 && (
            <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('inspector.contextWarning') || '上下文即将用满，建议压缩'}
            </div>
          )}
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.messageCount')}</span>
          <span className="inspector-stat-value">{messages.length}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">{t('inspector.toolCalls')}</span>
          <span className="inspector-stat-value">{usage.sessionToolCalls}</span>
        </div>
        {runningTools > 0 && (
          <div className="inspector-stat">
            <span className="inspector-stat-label">{t('inspector.running')}</span>
            <span className="inspector-stat-value" style={{ color: 'var(--warning)' }}>{runningTools}</span>
          </div>
        )}
        {contextPercent > 50 && (
          <div style={{ padding: '6px 0 0' }}>
            <button
              onClick={() => {
                const level = contextPercent > 85 ? '重度' : contextPercent > 70 ? '中度' : '轻度';
                if (confirm(`确定压缩上下文？当前使用 ${contextPercent.toFixed(0)}%，将执行${level}压缩。`)) {
                  useChatStore.getState().compactMessages();
                }
              }}
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {t('inspector.compactContext')}
            </button>
          </div>
        )}
      </div>

      {/* Agent Collaboration - bound to current session */}
      <AgentCollabInspector />

      {/* Execution Log */}
      {toolCalls.length > 0 && (
        <div className="inspector-card">
          <div className="inspector-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wrench size={12} strokeWidth={1.7} /> {t('inspector.executionLog')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            {toolCalls.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

/** Agent collaboration status in Inspector panel, bound to current session */
function AgentCollabInspector() {
  const _t = useT();
  const subagents = useChatStore((s) => s.subagents);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const running = subagents.filter((s) => s.status === 'running').length;
  const completed = subagents.filter((s) => s.status === 'completed').length;
  const failed = subagents.filter((s) => s.status === 'failed').length;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />;
      case 'completed': return <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />;
      case 'failed': return <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error)', display: 'inline-block' }} />;
      default: return <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', opacity: 0.5 }} />;
    }
  };

  return (
    <div className="inspector-card">
      <div className="inspector-card-title">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={12} strokeWidth={1.7} /> Agent 协同
          {subagents.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
              {running > 0 && <span style={{ color: 'var(--accent)' }}>{running}运行</span>}
              {running > 0 && completed > 0 && ' · '}
              {completed > 0 && <span style={{ color: 'var(--success)' }}>{completed}完成</span>}
              {failed > 0 && <span style={{ color: 'var(--error)' }}> · {failed}失败</span>}
            </span>
          )}
        </span>
      </div>
      {subagents.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
          {isStreaming ? '等待 Agent 协同...' : '暂无子 Agent 任务'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subagents.map((agent) => (
            <div
              key={agent.id}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                background: 'var(--bg-hover, rgba(255,255,255,0.03))',
                fontSize: 11,
                borderLeft: `2px solid ${agent.status === 'running' ? 'var(--accent)' : agent.status === 'completed' ? 'var(--success)' : agent.status === 'failed' ? 'var(--error)' : 'var(--text-muted)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {statusIcon(agent.status)}
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{agent.name}</span>
                {agent.toolCalls > 0 && (
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>
                    {agent.toolCalls}工具 · {((agent.inputTokens + agent.outputTokens) / 1000).toFixed(1)}K
                  </span>
                )}
              </div>
              {agent.latestToolCall && agent.status === 'running' && (
                <div style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono, monospace)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  └ {agent.latestToolCall}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}