import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Database, Cpu, HardDrive, Wifi, RefreshCw, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import { useChatStore } from '../../stores/chatStore';

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

interface SystemInfo {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  diskUsage: number;
  uptime: number;
}

export function ConsolePanel() {
  const t = useT();
  const { usage, toolCalls } = useChatStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load system info
    loadSystemInfo();
    const interval = setInterval(loadSystemInfo, 5000);

    // Subscribe to logs
    const unsubscribe = subscribeToLogs();

    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadSystemInfo = async () => {
    try {
      const info = await window.api?.system?.getInfo();
      if (info) {
        setSystemInfo(info);
      }
    } catch {
      // Use mock data if API not available
      setSystemInfo({
        cpuUsage: Math.random() * 30 + 10,
        memoryUsage: Math.random() * 2 + 1,
        memoryTotal: 8,
        diskUsage: Math.random() * 50 + 30,
        uptime: Date.now() - Math.random() * 86400000,
      });
    }
  };

  const subscribeToLogs = () => {
    // Subscribe to main process logs
    const handler = (_: unknown, ...args: unknown[]) => {
      const log = args[0] as LogEntry;
      setLogs(prev => [...prev.slice(-500), log]);
    };

    window.api?.on?.('log:entry', handler);

    return () => {
      window.api?.off?.('log:entry', handler);
    };
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.level === filter);

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'var(--error)';
      case 'warn': return 'var(--warning)';
      case 'info': return 'var(--accent)';
      case 'debug': return 'var(--text-muted)';
      default: return 'var(--text-secondary)';
    }
  };

  // Tool statistics
  const toolStats = toolCalls.reduce((acc, tool) => {
    acc[tool.name] = (acc[tool.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topTools = Object.entries(toolStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('console.title') || '可视化控制台'}
            </h2>
          </div>
          <button
            onClick={clearLogs}
            className="p-1 rounded hover:bg-opacity-10"
            style={{ color: 'var(--text-muted)' }}
            title={t('console.clearLogs') || '清空日志'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-4 gap-2 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <Cpu size={12} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>CPU</span>
          </div>
          <span className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? `${systemInfo.cpuUsage.toFixed(1)}%` : '--'}
          </span>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <Activity size={12} strokeWidth={1.7} style={{ color: 'var(--success)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>RAM</span>
          </div>
          <span className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? `${systemInfo.memoryUsage.toFixed(1)}GB` : '--'}
          </span>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <HardDrive size={12} strokeWidth={1.7} style={{ color: 'var(--warning)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Disk</span>
          </div>
          <span className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? `${systemInfo.diskUsage.toFixed(0)}%` : '--'}
          </span>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <Wifi size={12} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uptime</span>
          </div>
          <span className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? formatUptime(systemInfo.uptime) : '--'}
          </span>
        </div>
      </div>

      {/* Token Stats */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('console.totalTokens') || '总 Tokens'}</span>
          <div className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            {usage.sessionTokens.toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('console.toolCalls') || '工具调用'}</span>
          <div className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            {usage.sessionToolCalls}
          </div>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('console.cost') || '费用'}</span>
          <div className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
            ${usage.sessionCost.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Top Tools */}
      {topTools.length > 0 && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('console.topTools') || '常用工具'}
          </h3>
          <div className="space-y-1">
            {topTools.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{name}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Filter */}
      <div className="flex gap-1 p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {['all', 'info', 'warn', 'error', 'debug'].map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className="px-2 py-1 text-xs rounded"
            style={{
              background: filter === level ? 'var(--accent)' : 'var(--bg-surface)',
              color: filter === level ? 'white' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs" style={{ background: 'var(--bg-base)' }}>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {t('console.noLogs') || '暂无日志'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="py-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="mx-2 px-1 rounded" style={{
                background: getLogLevelColor(log.level),
                color: 'white',
                fontSize: '10px',
              }}>
                {log.level}
              </span>
              {log.source && (
                <span className="mr-2" style={{ color: 'var(--accent)' }}>[{log.source}]</span>
              )}
              <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
