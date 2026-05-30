import React from 'react';
import { Wrench, Activity, Layers, Zap } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';

interface ToolPanelProps {
  forceOpen?: boolean;
}

export function ToolPanel({ forceOpen }: ToolPanelProps) {
  const { toolCalls, usage, messages, isThinking, isStreaming } = useChatStore();
  const { config } = useConfigStore();
  const runningTools = toolCalls.filter((t) => t.status === 'running').length;

  const hasRunningTool = toolCalls.some((t) => t.status === 'running');
  const agentStatus = !config.apiKeyConfigured
    ? '未配置'
    : hasRunningTool
      ? '执行中'
      : isThinking
        ? '思考中'
        : isStreaming
          ? '输出中'
          : '就绪';

  const agentStatusColor = !config.apiKeyConfigured
    ? 'var(--warning)'
    : hasRunningTool || isThinking || isStreaming
      ? 'var(--accent)'
      : 'var(--success)';

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
            <Layers size={12} strokeWidth={1.7} /> Token Usage
          </span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">会话 Tokens</span>
          <span className="inspector-stat-value">{usage.sessionTokens.toLocaleString()}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">总 Tokens</span>
          <span className="inspector-stat-value">{usage.totalTokens.toLocaleString()}</span>
        </div>
        <div className="inspector-stat">
          <span className="inspector-stat-label">费用</span>
          <span className="inspector-stat-value">${usage.sessionCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Context */}
      <div className="inspector-card">
        <div className="inspector-card-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={12} strokeWidth={1.7} /> 上下文
          </span>
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
