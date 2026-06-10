import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, AlertCircle, Info, CheckCircle, X, RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';
import { useToast } from '../common/Toast';

interface SupervisorViolation {
  ruleId: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  timestamp: number;
}

interface SupervisorStats {
  info: number;
  warning: number;
  error: number;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'var(--accent)', bg: 'var(--accent-bg)' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-bg)' },
  error: { icon: AlertCircle, color: 'var(--error)', bg: 'var(--error-bg)' },
};

interface SupervisorPanelProps {
  onClose: () => void;
}

export function SupervisorPanel({ onClose }: SupervisorPanelProps) {
  const t = useT();
  const { toast } = useToast();
  const [violations, setViolations] = useState<SupervisorViolation[]>([]);
  const [stats, setStats] = useState<SupervisorStats>({ info: 0, warning: 0, error: 0 });
  const [filter, setFilter] = useState<string>('all');
  const [isEnabled, setIsEnabled] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadViolations();

    // Subscribe to real-time violations
    const unsubscribe = subscribeToViolations();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const loadViolations = async () => {
    setIsLoading(true);
    try {
      const result = await window.api?.supervisor?.getViolations();
      if (result?.violations) {
        setViolations(result.violations);
        updateStatsFromList(result.violations);
      }
    } catch {
      // Use mock data for demo
      const mockViolations: SupervisorViolation[] = [
        { ruleId: 'code-quality-check', severity: 'info', message: '代码质量问题: 包含 console.log 语句', suggestion: '考虑在提交前修复这些问题', timestamp: Date.now() - 60000 },
        { ruleId: 'large-file-write', severity: 'warning', message: '写入大文件 (1500 行)', suggestion: '考虑将大文件拆分为多个较小的模块', timestamp: Date.now() - 30000 },
      ];
      setViolations(mockViolations);
      updateStatsFromList(mockViolations);
      setIsMockData(true);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToViolations = () => {
    const handler = (_: unknown, ...args: unknown[]) => {
      const violation = args[0] as SupervisorViolation;
      setViolations(prev => {
        const updated = [...prev, violation].slice(-100);
        updateStatsFromList(updated);
        return updated;
      });
    };

    window.api?.on?.('supervisor:violation', handler);

    return () => {
      window.api?.off?.('supervisor:violation', handler);
    };
  };

  const updateStatsFromList = (viols: SupervisorViolation[]) => {
    setStats({
      info: viols.filter(v => v.severity === 'info').length,
      warning: viols.filter(v => v.severity === 'warning').length,
      error: viols.filter(v => v.severity === 'error').length,
    });
  };

  const _clearViolations = () => {
    setViolations([]);
    setStats({ info: 0, warning: 0, error: 0 });
  };

  const toggleSupervisor = async () => {
    const newState = !isEnabled;
    setIsToggling(true);
    try {
      await window.api?.supervisor?.setEnabled(newState);
      setIsEnabled(newState);
      toast(`督导已${newState ? '启用' : '禁用'}`, 'success');
    } catch {
      toast('切换失败', 'error');
    } finally {
      setIsToggling(false);
    }
  };

  const filteredViolations = filter === 'all'
    ? violations
    : violations.filter(v => v.severity === filter);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('supervisor.title') || '编程督导'}
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
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSupervisor}
              disabled={isToggling}
              className="px-2 py-1 text-xs rounded"
              style={{
                background: isEnabled ? 'var(--success)' : 'var(--text-muted)',
                color: 'white',
                border: 'none',
                cursor: isToggling ? 'not-allowed' : 'pointer',
                opacity: isToggling ? 0.6 : 1,
              }}
            >
              {isToggling ? '处理中...' : isEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => { loadViolations(); }}
              className="p-1 rounded hover:bg-opacity-10"
              style={{ color: isLoading ? 'var(--text-muted)' : 'var(--text-primary)', opacity: isLoading ? 0.5 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
              disabled={isLoading}
              title={isLoading ? '加载中...' : (t('common.refresh') || '刷新')}
            >
              <RefreshCw size={14} style={isLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
            </button>
            <button onClick={onClose} className="icon-button" title={t('common.close') || '关闭'}>
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-3 rounded-lg" style={{ background: SEVERITY_CONFIG.info.bg }}>
          <div className="flex items-center gap-1 mb-1">
            <Info size={12} style={{ color: SEVERITY_CONFIG.info.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Info</span>
          </div>
          <span className="text-lg font-mono" style={{ color: SEVERITY_CONFIG.info.color }}>
            {stats.info}
          </span>
        </div>
        <div className="p-3 rounded-lg" style={{ background: SEVERITY_CONFIG.warning.bg }}>
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={12} style={{ color: SEVERITY_CONFIG.warning.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Warning</span>
          </div>
          <span className="text-lg font-mono" style={{ color: SEVERITY_CONFIG.warning.color }}>
            {stats.warning}
          </span>
        </div>
        <div className="p-3 rounded-lg" style={{ background: SEVERITY_CONFIG.error.bg }}>
          <div className="flex items-center gap-1 mb-1">
            <AlertCircle size={12} style={{ color: SEVERITY_CONFIG.error.color }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Error</span>
          </div>
          <span className="text-lg font-mono" style={{ color: SEVERITY_CONFIG.error.color }}>
            {stats.error}
          </span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {['all', 'info', 'warning', 'error'].map((level) => (
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

      {/* Violations */}
      <div className="flex-1 overflow-y-auto">
        {filteredViolations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
            <CheckCircle size={48} strokeWidth={1} className="mb-4 opacity-50" style={{ color: 'var(--success)' }} />
            <p className="text-sm">{t('supervisor.noViolations') || '暂无督导问题'}</p>
          </div>
        ) : (
          filteredViolations.map((violation, i) => {
            const config = SEVERITY_CONFIG[violation.severity];
            const Icon = config.icon;
            return (
              <div
                key={i}
                className="p-3 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-start gap-2">
                  <Icon size={14} style={{ color: config.color, marginTop: 2 }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: config.bg, color: config.color }}>
                        {violation.severity}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {violation.ruleId}
                      </span>
                      <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                        {new Date(violation.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {violation.message}
                    </p>
                    {violation.suggestion && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        💡 {violation.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
