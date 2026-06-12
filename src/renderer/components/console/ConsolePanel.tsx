import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, HardDrive, Wifi, Trash2, X, Database } from 'lucide-react';
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

interface ConsolePanelProps {
  onClose: () => void;
}

// ===== Pixel Art Mascot =====
// A cute 8-bit AI assistant character rendered with CSS

type MascotState = 'idle' | 'thinking' | 'working' | 'error' | 'sleeping';

function PixelMascot({ state }: { state: MascotState }) {
  // 16x16 pixel grid - each row is a string of hex colors or transparent
  // Design: a small robot/cat-like AI assistant with glowing eyes
  const frames: Record<MascotState, string[][]> = {
    idle: [
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#FBBF24','#60A5FA','#60A5FA','#FBBF24','#3B82F6','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','',''],
      ['','','','','','#3B82F6','#60A5FA','#EF4444','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','',''],
      ['','','','','','','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','#3B82F6','','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','','','#3B82F6','','','','','',''],
      ['','','','','','#3B82F6','','','#3B82F6','','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
    ],
    thinking: [
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#FBBF24','#60A5FA','#60A5FA','#FBBF24','#3B82F6','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','',''],
      ['','','','','','#3B82F6','#60A5FA','#FBBF24','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','',''],
      ['','','','','','','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','#3B82F6','','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','','','#3B82F6','','','','','',''],
      ['','','','','','#3B82F6','','','#3B82F6','','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
      ['','','','','#FBBF24','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#FBBF24','','','',''],
    ],
    working: [
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#22C55E','#60A5FA','#60A5FA','#22C55E','#3B82F6','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','',''],
      ['','','','','','#3B82F6','#60A5FA','#22C55E','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','',''],
      ['','','','','','','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','#3B82F6','','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','#3B82F6','#3B82F6','','','#3B82F6','#3B82F6','','','','',''],
      ['','','','#3B82F6','#3B82F6','','','','','#3B82F6','#3B82F6','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
    ],
    error: [
      ['','','','','','#EF4444','#EF4444','#EF4444','#EF4444','','','','','',''],
      ['','','','','#EF4444','#F87171','#F87171','#F87171','#F87171','#EF4444','','','','',''],
      ['','','','','#EF4444','#F87171','#FBBF24','#F87171','#F87171','#FBBF24','#EF4444','','','',''],
      ['','','','','#EF4444','#F87171','#F87171','#F87171','#F87171','#F87171','#EF4444','','','',''],
      ['','','','','','#EF4444','#F87171','#FBBF24','#F87171','#EF4444','','','','',''],
      ['','','','','','#EF4444','#EF4444','#EF4444','#EF4444','#EF4444','','','','',''],
      ['','','','','','','#EF4444','#EF4444','#EF4444','','','','','',''],
      ['','','','','#EF4444','#EF4444','#F87171','#F87171','#F87171','#EF4444','#EF4444','','','',''],
      ['','','','#EF4444','#F87171','#F87171','#F87171','#F87171','#F87171','#F87171','#F87171','#EF4444','','',''],
      ['','','','#EF4444','#F87171','#F87171','#F87171','#F87171','#F87171','#F87171','#F87171','#EF4444','','',''],
      ['','','','#EF4444','#F87171','#F87171','#F87171','#F87171','#F87171','#F87171','#F87171','#EF4444','','',''],
      ['','','','','','#EF4444','#F87171','#F87171','#F87171','#EF4444','','','','',''],
      ['','','','','','#EF4444','','','#EF4444','','','','','',''],
      ['','','','','','#EF4444','','','#EF4444','','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
    ],
    sleeping: [
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','',''],
      ['','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','',''],
      ['','','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','#3B82F6','#3B82F6','#3B82F6','#3B82F6','','','','',''],
      ['','','','','','','#3B82F6','#3B82F6','#3B82F6','','','','','',''],
      ['','','','','#3B82F6','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','#3B82F6','','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','',''],
      ['','','','','','#3B82F6','#60A5FA','#60A5FA','#60A5FA','#3B82F6','','','','',''],
      ['','','','','','#3B82F6','','','#3B82F6','','','','','',''],
      ['','','','','','#3B82F6','','','#3B82F6','','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
      ['','','','','','#1E1E22','#1E1E22','#1E1E22','#1E1E22','#1E1E22','','','','',''],
    ],
  };

  const [frame, setFrame] = useState(0);
  const grid = frames[state] || frames.idle;

  useEffect(() => {
    // Blink animation for idle state
    if (state === 'idle') {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % 4);
      }, 3000);
      return () => clearInterval(interval);
    }
    if (state === 'thinking') {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % 2);
      }, 800);
      return () => clearInterval(interval);
    }
    if (state === 'working') {
      const interval = setInterval(() => {
        setFrame(f => (f + 1) % 2);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [state]);

  // For idle blink: frame 1 = eyes closed variant
  const displayGrid = state === 'idle' && frame % 2 === 1
    ? grid.map((row, ri) => ri === 2 ? row.map((c, ci) => (ci === 2 || ci === 9) ? '' : c) : row)
    : grid;

  return (
    <div style={{
      display: 'inline-grid',
      gridTemplateColumns: 'repeat(16, 4px)',
      gridTemplateRows: 'repeat(16, 4px)',
      gap: 0,
      imageRendering: 'pixelated' as const,
    }}>
      {displayGrid.flat().map((color, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 4,
            background: color || 'transparent',
            transition: state === 'working' ? 'background 100ms' : undefined,
          }}
        />
      ))}
    </div>
  );
}

// ===== Speech Bubble =====

function SpeechBubble({ state }: { state: MascotState }) {
  const messages: Record<MascotState, string> = {
    idle: '...',
    thinking: 'Hmm...',
    working: 'Working!',
    error: '?!',
    sleeping: 'zzZ',
  };

  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '8px 8px 8px 0',
      padding: '4px 8px',
      fontSize: 10,
      color: 'var(--text-muted)',
      fontFamily: 'var(--font-mono, monospace)',
      whiteSpace: 'nowrap',
    }}>
      {messages[state]}
    </div>
  );
}

// ===== Main Console Panel =====

export function ConsolePanel({ onClose }: ConsolePanelProps) {
  const t = useT();
  const { usage, toolCalls, isThinking, isStreaming } = useChatStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [dataUnavailable, setDataUnavailable] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Determine mascot state from agent status
  const mascotState: MascotState = (() => {
    if (isThinking) return 'thinking';
    if (isStreaming) return 'working';
    const hasErrors = toolCalls.some(tc => tc.status === 'error');
    if (hasErrors) return 'error';
    if (toolCalls.length === 0 && !isThinking && !isStreaming) return 'sleeping';
    return 'idle';
  })();

  useEffect(() => {
    loadSystemInfo();
    const interval = setInterval(loadSystemInfo, 5000);

    // Load historical logs first, then subscribe to real-time to avoid duplicates
    let unsubscribe: (() => void) | undefined;
    loadHistoricalLogs().then(() => {
      unsubscribe = subscribeToLogs();
    });

    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const loadSystemInfo = async () => {
    try {
      const info = await window.api?.system?.getInfo();
      if (info) setSystemInfo(info);
    } catch {
      // Keep existing data if available; don't overwrite with random values
      setDataUnavailable(true);
    }
  };

  const loadHistoricalLogs = async () => {
    try {
      const history = await window.api?.console?.getLogs();
      if (Array.isArray(history) && history.length > 0) {
        setLogs(prev => [...history, ...prev].slice(-500));
      }
    } catch { /* ignore */ }
  };

  const subscribeToLogs = () => {
    const handler = (_: unknown, ...args: unknown[]) => {
      const log = args[0] as LogEntry;
      setLogs(prev => [...prev.slice(-500), log]);
    };
    window.api?.on?.('log:entry', handler);
    return () => { window.api?.off?.('log:entry', handler); };
  };

  const clearLogs = () => {
    if (!confirm('确定要清空日志吗？')) return;
    setLogs([]);
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

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

  const toolStats = toolCalls.reduce((acc, tool) => {
    acc[tool.name] = (acc[tool.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topTools = Object.entries(toolStats).sort(([, a], [, b]) => b - a).slice(0, 5);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('console.title') || '控制台'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={clearLogs} className="icon-button" title={t('console.clearLogs') || '清空日志'}>
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="icon-button" title={t('common.close') || '关闭'}>
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mascot Area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '20px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <PixelMascot state={mascotState} />
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {mascotState === 'idle' ? 'Ready' :
             mascotState === 'thinking' ? 'Thinking...' :
             mascotState === 'working' ? 'Working!' :
             mascotState === 'error' ? 'Error!' : 'Sleeping'}
          </span>
        </div>
        <SpeechBubble state={mascotState} />
      </div>

      {/* System Status */}
      <div className="grid grid-cols-4 gap-2 p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <Cpu size={10} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>CPU</span>
          </div>
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? `${(systemInfo.cpuUsage ?? 0).toFixed(1)}%` : (dataUnavailable ? '数据不可用' : '--')}
          </span>
        </div>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <HardDrive size={10} strokeWidth={1.7} style={{ color: 'var(--success)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>RAM</span>
          </div>
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? `${(systemInfo.memoryUsage ?? 0).toFixed(1)}GB` : (dataUnavailable ? '数据不可用' : '--')}
          </span>
        </div>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <HardDrive size={10} strokeWidth={1.7} style={{ color: 'var(--warning)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>Disk</span>
          </div>
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? `${(systemInfo.diskUsage ?? 0).toFixed(0)}%` : (dataUnavailable ? '数据不可用' : '--')}
          </span>
        </div>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1 mb-1">
            <Wifi size={10} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>Uptime</span>
          </div>
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {systemInfo ? formatUptime(systemInfo.uptime) : (dataUnavailable ? '数据不可用' : '--')}
          </span>
        </div>
      </div>

      {/* Token Stats */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('console.totalTokens') || 'Tokens'}</span>
          <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {usage.sessionTokens > 1000 ? `${(usage.sessionTokens / 1000).toFixed(1)}K` : usage.sessionTokens}
          </div>
        </div>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('console.toolCalls') || 'Tools'}</span>
          <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            {usage.sessionToolCalls}
          </div>
        </div>
        <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{t('console.cost') || 'Cost'}</span>
          <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
            ${(usage.sessionCost ?? 0).toFixed(4)}
          </div>
        </div>
      </div>

      {/* Cache Stats */}
      {usage.sessionPromptTokens > 0 && (
        <div className="grid grid-cols-3 gap-2 p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Database size={10} strokeWidth={1.7} style={{ color: 'var(--success)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>缓存命中</span>
            </div>
            <span className="text-sm font-mono" style={{ color: usage.sessionCachedTokens > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {usage.sessionCachedTokens > 1000 ? `${(usage.sessionCachedTokens / 1000).toFixed(1)}K` : usage.sessionCachedTokens}
            </span>
          </div>
          <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Database size={10} strokeWidth={1.7} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>缓存未命中</span>
            </div>
            <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              {Math.max(0, usage.sessionPromptTokens - usage.sessionCachedTokens) > 1000
                ? `${(Math.max(0, usage.sessionPromptTokens - usage.sessionCachedTokens) / 1000).toFixed(1)}K`
                : Math.max(0, usage.sessionPromptTokens - usage.sessionCachedTokens)}
            </span>
          </div>
          <div className="p-2 rounded" style={{ background: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-1 mb-1">
              <Database size={10} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>命中率</span>
            </div>
            <span className="text-sm font-mono" style={{ color: usage.sessionCachedTokens > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {((usage.sessionCachedTokens / usage.sessionPromptTokens) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Top Tools */}
      {topTools.length > 0 && (
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xs mb-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {t('console.topTools') || 'Top Tools'}
          </h3>
          <div className="flex flex-wrap gap-1">
            {topTools.map(([name, count]) => (
              <span key={name} style={{
                padding: '2px 6px',
                borderRadius: 4,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                fontSize: 10,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-secondary)',
              }}>
                {name} <span style={{ color: 'var(--text-muted)' }}>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Log Filter */}
      <div className="flex gap-1 px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {['all', 'info', 'warn', 'error', 'debug'].map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: filter === level ? 'var(--accent)' : 'var(--bg-surface)',
              color: filter === level ? 'white' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {level}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ background: 'var(--bg-base)', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {t('console.noLogs') || '暂无日志'}
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div key={i} className="py-0.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span style={{
                marginLeft: 6,
                padding: '1px 4px',
                borderRadius: 3,
                background: getLogLevelColor(log.level),
                color: 'white',
                fontSize: 9,
              }}>
                {log.level}
              </span>
              {log.source && (
                <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 10 }}>[{log.source}]</span>
              )}
              <span style={{ marginLeft: 6, color: 'var(--text-primary)' }}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
