import React, { useState, useEffect } from 'react';
import { Users, Play, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useT } from '../../i18n';

interface AgentTask {
  id: string;
  agentName: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: string;
  dependencies?: string[];
  parentId?: string;
}

interface AgentCollaboration {
  id: string;
  name: string;
  tasks: AgentTask[];
  status: 'planning' | 'executing' | 'completed';
  createdAt: number;
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
  const [collaborations, setCollaborations] = useState<AgentCollaboration[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isMockData, setIsMockData] = useState(false);

  useEffect(() => {
    loadCollaborations();
  }, []);

  const loadCollaborations = async () => {
    try {
      const result = await window.api?.collaboration?.list();
      if (result?.collaborations) {
        setCollaborations(result.collaborations);
      }
    } catch {
      // Use mock data for demo
      setCollaborations([
        {
          id: '1',
          name: '代码重构任务',
          status: 'executing',
          createdAt: Date.now() - 300000,
          tasks: [
            { id: 't1', agentName: 'architect', task: '分析代码结构', status: 'completed', startTime: Date.now() - 280000, endTime: Date.now() - 250000 },
            { id: 't2', agentName: 'coder', task: '重构核心模块', status: 'running', startTime: Date.now() - 240000, dependencies: ['t1'] },
            { id: 't3', agentName: 'reviewer', task: '审查重构结果', status: 'pending', dependencies: ['t2'] },
            { id: 't4', agentName: 'tester', task: '运行测试', status: 'pending', dependencies: ['t2'] },
            { id: 't5', agentName: 'docgen', task: '更新文档', status: 'pending', dependencies: ['t3', 't4'] },
          ],
        },
      ]);
      setIsMockData(true);
    }
  };

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

  const getTaskDuration = (task: AgentTask) => {
    if (!task.startTime) return '--';
    const end = task.endTime || Date.now();
    const duration = end - task.startTime;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const renderTaskNode = (task: AgentTask, depth: number = 0) => {
    const StatusIcon = STATUS_ICONS[task.status];
    const agentColor = AGENT_COLORS[task.agentName] || 'var(--text-muted)';
    const isExpanded = expandedTasks.has(task.id);
    const hasChildren = collaborations.some(c => c.tasks.some(t => t.parentId === task.id));

    return (
      <div key={task.id} style={{ marginLeft: depth * 20 }}>
        <div
          className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-opacity-50"
          style={{ background: task.status === 'running' ? 'var(--accent-bg)' : 'transparent' }}
          onClick={() => toggleTaskExpand(task.id)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div style={{ width: 14 }} />
          )}

          <span style={{ color: task.status === 'completed' ? 'var(--success)' : task.status === 'failed' ? 'var(--error)' : task.status === 'running' ? 'var(--accent)' : 'var(--text-muted)' }}>
            <StatusIcon
              size={14}
              className={task.status === 'running' ? 'animate-pulse' : ''}
            />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: agentColor, color: 'white' }}>
                {task.agentName}
              </span>
              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {task.task}
              </span>
            </div>
          </div>

          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {getTaskDuration(task)}
          </span>
        </div>

        {isExpanded && task.result && (
          <div className="ml-8 p-2 rounded text-xs" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
            {task.result}
          </div>
        )}
      </div>
    );
  };

  const renderDependencyGraph = (tasks: AgentTask[]) => {
    // Simple dependency visualization
    const levels: AgentTask[][] = [];
    const visited = new Set<string>();

    const addToLevel = (task: AgentTask, level: number) => {
      if (visited.has(task.id)) return;
      visited.add(task.id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(task);

      // Find tasks that depend on this one
      tasks.filter(t => t.dependencies?.includes(task.id)).forEach(t => addToLevel(t, level + 1));
    };

    // Start with tasks that have no dependencies
    tasks.filter(t => !t.dependencies || t.dependencies.length === 0).forEach(t => addToLevel(t, 0));

    return (
      <div className="flex gap-4 overflow-x-auto p-4">
        {levels.map((level, i) => (
          <div key={i} className="flex flex-col gap-2 min-w-[150px]">
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Stage {i + 1}
            </div>
            {level.map(task => {
              const StatusIcon = STATUS_ICONS[task.status];
              const agentColor = AGENT_COLORS[task.agentName] || 'var(--text-muted)';
              return (
                <div
                  key={task.id}
                  className="p-2 rounded-lg border"
                  style={{
                    borderColor: task.status === 'running' ? 'var(--accent)' : 'var(--border-subtle)',
                    background: task.status === 'running' ? 'var(--accent-bg)' : 'var(--bg-surface)',
                  }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span style={{ color: task.status === 'completed' ? 'var(--success)' : task.status === 'running' ? 'var(--accent)' : 'var(--text-muted)' }}>
                      <StatusIcon size={12} />
                    </span>
                    <span className="text-xs px-1 rounded" style={{ background: agentColor, color: 'white' }}>
                      {task.agentName}
                    </span>
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                    {task.task}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Users size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('collaboration.title') || '多 Agent 协同'}
          </h2>
          {isMockData && (
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--warning)',
              color: 'white',
              fontSize: 10,
              fontWeight: 600,
            }}>演示数据</span>
          )}
        </div>
      </div>

      {/* Collaborations */}
      <div className="flex-1 overflow-y-auto">
        {collaborations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
            <Users size={48} strokeWidth={1} className="mb-4 opacity-50" />
            <p className="text-sm">{t('collaboration.noCollaborations') || '暂无协同任务'}</p>
          </div>
        ) : (
          collaborations.map(collab => (
            <div key={collab.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Collaboration Header */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {collab.name}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded" style={{
                    background: collab.status === 'completed' ? 'var(--success)' : collab.status === 'executing' ? 'var(--accent)' : 'var(--warning)',
                    color: 'white',
                  }}>
                    {collab.status}
                  </span>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg-surface)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(collab.tasks.filter(t => t.status === 'completed').length / collab.tasks.length) * 100}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {collab.tasks.filter(t => t.status === 'completed').length}/{collab.tasks.length}
                  </span>
                </div>

                {/* Dependency Graph */}
                {renderDependencyGraph(collab.tasks)}

                {/* Task List */}
                <div className="mt-3">
                  <h4 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('collaboration.tasks') || '任务列表'}
                  </h4>
                  {collab.tasks.map(task => renderTaskNode(task))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
