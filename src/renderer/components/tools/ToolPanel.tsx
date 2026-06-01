import React from 'react';
import { Wrench, Activity, Layers, Zap, Database, HardDrive } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';

interface ToolPanelProps {
  forceOpen?: boolean;
}

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

export function ToolPanel({ forceOpen }: ToolPanelProps) {
  const { toolCalls, usage, messages, isThinking, isStreaming } = useChatStore();
  const { config, apiStatus } = useConfigStore();
  const runningTools = toolCalls.filter((t) => t.status === 'running').length;

  const hasRunningTool = toolCalls.some((t) => t.status === 'running');
  const agentStatus = !config.apiKeyConfigured
    ? '未配置'
    : apiStatus === 'checking'
      ? '验证中'
      : apiStatus === 'invalid'
        ? 'API 异常'
        : hasRunningTool
          ? '执行中'
          : isThinking
            ? '思考中'
            : isStreaming
              ? '输出中'
              : '就绪';

  const agentStatusColor = !config.apiKeyConfigured
    ? 'var(--warning)'
    : apiStatus === 'invalid'
      ? 'var(--error)'
      : hasRunningTool || isThinking || isStreaming
        ? 'var(--accent)'
        : 'var(--success)';

  // Context usage - estimate from message content (not cumulative tokens)
  const contextWindow = getContextWindow(config.model);
  const estimatedContextTokens = messages.reduce((sum, m) => {
    return sum + Math.ceil((m.content?.length || 0) / 3) + 50;
  }, 2000);
  const contextPercent = Math.min((estimatedContextTokens / contextWindow) * 100, 100);
  const contextColor = contextPercent > 75 ? 'var(--error)' : contextPercent > 50 ? 'var(--warning)' : 'var(--accent)';

  // Cache stats
  const cacheHit = usage.sessionCachedTokens;
  const cacheMiss = usage.sessionPromptTokens - cacheHit;

  return (
    <aside
      className={`inspector-panel xl:block ${forceOpen ? 'block' : 'hidden'}`}
    >
      <div className="inspector-header">
        <div className="inspector-title">Inspector</div>
        <div className="inspector-subtitle">当前任务状态</div>
      </div>

      {/* Agent Status */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} strokeWidth={1.7} /> Agent 状态
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">状态</span>
          <span className="inspector-stat-value" style={{ color: agentStatusColor, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: agentStatusColor, display: 'inline-block', ...(isThinking || isStreaming || hasRunningTool ? { animation: 'pulse-dot 2s ease-in-out infinite' } : {}) }} />
            {agentStatus}
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">模型</span>
          <span className="inspector-stat-value">{config.model}</span>
        </div>
      </div>

      {/* Token Usage */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} strokeWidth={1.7} /> Token 用量
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">输入 Tokens</span>
          <span className="inspector-stat-value">{usage.sessionPromptTokens.toLocaleString()}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">输出 Tokens</span>
          <span className="inspector-stat-value">{usage.sessionCompletionTokens.toLocaleString()}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">会话总计</span>
          <span className="inspector-stat-value" style={{ fontWeight: 600 }}>{usage.sessionTokens.toLocaleString()}</span>
        </div>
      </div>

      {/* Cache Stats */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={12} strokeWidth={1.7} /> 缓存统计
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">命中</span>
          <span className="inspector-stat-value" style={{ color: 'var(--success)' }}>{cacheHit.toLocaleString()}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">未命中</span>
          <span className="inspector-stat-value" style={{ color: cacheMiss > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{Math.max(0, cacheMiss).toLocaleString()}</span>
        </div>
        {usage.sessionPromptTokens > 0 && (
          <div className="inspector-stat">
            <span className="inspector-stat-label">命中率</span>
            <span className="inspector-stat-value" style={{ color: cacheHit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {((cacheHit / usage.sessionPromptTokens) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Context Window */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={12} strokeWidth={1.7} /> 上下文窗口
          </span>
        </div>
        <div style={{ padding: '0 0 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>{estimatedContextTokens.toLocaleString()} / {formatContextWindow(contextWindow)}</span>
            <span style={{ color: contextColor, fontWeight: 600 }}>{contextPercent.toFixed(1)}%</span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${contextPercent}%`,
              height: '100%',
              borderRadius: 3,
              transition: 'width 300ms ease, background 300ms ease',
              background: contextColor,
            }} />
          </div>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">消息数</span>
          <span className="inspector-stat-value">{messages.length}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">工具调用</span>
          <span className="inspector-stat-value">{usage.sessionToolCalls}</span>
        </div>
        {runningTools > 0 && (
          <div className="inspector-stat">
            <span className="inspector-stat-label">运行中</span>
            <span className="inspector-stat-value" style={{ color: 'var(--warning)' }}>{runningTools}</span>
          </div>
        )}
        {contextPercent > 50 && (
          <div style={{ padding: '6px 0 0' }}>
            <button
              onClick={() => useChatStore.getState().compactMessages()}
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
              压缩上下文
            </button>
          </div>
        )}
      </div>

      {/* Execution Log */}
      {toolCalls.length > 0 && (
        <div className="inspector-card">
          <div className="inspector-card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wrench size={12} strokeWidth={1.7} /> 执行日志
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
