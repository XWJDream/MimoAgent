import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Play, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useT } from '../../i18n';

interface CollaborationTask {
  id: string;
  name: string;
  agentType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  prompt: string;
  result?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
}

const AGENT_COLORS: Record<string, string> = {
  coder: 'var(--accent)',
  reviewer: 'var(--success)',
  tester: 'var(--warning)',
  docgen: '#9333ea',
  architect: '#ec4899',
  summarizer: '#6b7280',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  pending: Clock,
  running: Play,
  completed: CheckCircle,
  failed: XCircle,
};

export function CollaborationPanel() {
  const t = useT();
  const [tasks, setTasks] = useState<CollaborationTask[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  // Load initial data
  const loadTasks = useCallback(async () => {
    try {
      const result = await window.api?.collaboration?.list();
      if (result?.collaborations && mountedRef.current) {
        setTasks(result.collaborations);
      }
    } catch {
      // Silently handle - will show empty state
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadTasks();

    return () => {
      mountedRef.current = false;
    };
  }, [loadTasks]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = window.api?.collaboration?.onUpdate?.((task: unknown) => {
      if (!task || typeof task !== 'object' || !mountedRef.current) return;
      const collabTask = task as CollaborationTask;
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === collabTask.id);
        if (idx >= 0) {
          // Update existing task
          const next = [...prev];
          next[idx] = { ...next[idx], ...collabTask };
          return next;
        }
        // Add new task
        return [...prev, collabTask];
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getTaskDuration = (task: CollaborationTask) => {
    if (!task.startTime) return '--';
    const end = task.endTime || Date.now();
    const duration = end - task.startTime;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Users size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('collaboration.title') || '多 Agent 协同'}
          </h2>
          {tasks.length > 0 && (
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {runningCount > 0 && (
                <span className="mr-2" style={{ color: 'var(--accent)' }}>
                  <Zap size={12} className="inline mr-0.5" />
                  {runningCount} {t('collaboration.running') || '运行中'}
                </span>
              )}
              {completedCount}/{tasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6" style={{ color: 'var(--text-muted)' }}>
            <Users size={48} strokeWidth={1} className="mb-4 opacity-50" />
            <p className="text-sm text-center mb-2">
              {t('collaboration.noCollaborations') || '暂无协作任务'}
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              {t('collaboration.hint') || '使用 sub_agents_run 工具时，子 Agent 协同信息将在此展示。'}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {/* Progress bar */}
            {tasks.length > 1 && (
              <div className="flex items-center gap-2 mb-3 px-2">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg-surface)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(completedCount / tasks.length) * 100}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {completedCount}/{tasks.length}
                </span>
              </div>
            )}

            {/* Task items */}
            {tasks.map(task => {
              const StatusIcon = STATUS_ICONS[task.status] || Clock;
              const agentColor = AGENT_COLORS[task.agentType] || 'var(--text-muted)';
              const isExpanded = expandedTasks.has(task.id);

              return (
                <div
                  key={task.id}
                  className="mb-1 rounded-lg overflow-hidden"
                  style={{
                    background: task.status === 'running' ? 'var(--accent-bg)' : 'transparent',
                    border: task.status === 'running' ? '1px solid var(--accent)' : '1px solid transparent',
                  }}
                >
                  <div
                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-opacity-50 rounded-lg"
                    onClick={() => toggleTaskExpand(task.id)}
                  >
                    {/* Expand icon */}
                    {(task.result || task.error) ? (
                      isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <div style={{ width: 14 }} />
                    )}

                    {/* Status icon */}
                    <span style={{
                      color: task.status === 'completed' ? 'var(--success)'
                        : task.status === 'failed' ? 'var(--error)'
                        : task.status === 'running' ? 'var(--accent)'
                        : 'var(--text-muted)',
                    }}>
                      <StatusIcon
                        size={14}
                        className={task.status === 'running' ? 'animate-pulse' : ''}
                      />
                    </span>

                    {/* Agent type badge + task name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: agentColor, color: 'white' }}
                        >
                          {task.agentType}
                        </span>
                        <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {task.name}
                        </span>
                      </div>
                    </div>

                    {/* Duration */}
                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {getTaskDuration(task)}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-2">
                      {/* Prompt */}
                      <div className="mb-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                          Prompt:
                        </span>
                        <div
                          className="mt-0.5 p-2 rounded text-xs whitespace-pre-wrap"
                          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                        >
                          {task.prompt}
                        </div>
                      </div>

                      {/* Result or Error */}
                      {task.result && (
                        <div className="mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                            {t('collaboration.result') || '结果'}:
                          </span>
                          <div
                            className="mt-0.5 p-2 rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto"
                            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                          >
                            {task.result}
                          </div>
                        </div>
                      )}
                      {task.error && (
                        <div className="mb-1">
                          <span className="text-xs font-medium" style={{ color: 'var(--error)' }}>
                            {t('collaboration.error') || '错误'}:
                          </span>
                          <div
                            className="mt-0.5 p-2 rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto"
                            style={{ background: 'var(--bg-surface)', color: 'var(--error)' }}
                          >
                            {task.error}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      {(task.inputTokens > 0 || task.outputTokens > 0 || task.toolCalls > 0) && (
                        <div className="flex gap-3 mt-1">
                          {task.toolCalls > 0 && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Tool calls: {task.toolCalls}
                            </span>
                          )}
                          {task.inputTokens > 0 && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              In: {task.inputTokens}
                            </span>
                          )}
                          {task.outputTokens > 0 && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Out: {task.outputTokens}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
