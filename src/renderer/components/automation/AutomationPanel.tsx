import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, Play, Clock3, Zap, CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AutomationRule, AutomationExecution } from '../../../shared/types';

interface AutomationPanelProps {
  onClose: () => void;
}

const TRIGGER_LABELS: Record<string, string> = {
  'file-change': '文件变更',
  'message-count': '消息计数',
  'manual': '手动触发',
  'schedule': '定时执行',
};

const ACTION_LABELS: Record<string, string> = {
  'run-prompt': '运行提示',
  'run-tool': '运行工具',
  'notify': '发送通知',
};

export function AutomationPanel({ onClose }: AutomationPanelProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, execList] = await Promise.all([
        window.api.automation.getRules(),
        window.api.automation.getExecutions(),
      ]);
      setRules(ruleList || []);
      setExecutions(execList || []);
    } catch (err) {
      console.error('Failed to load automation data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleRule = async (id: string, enabled: boolean) => {
    setError(null);
    try {
      await window.api.automation.toggleRule(id, enabled);
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
      setSuccessMsg(enabled ? '规则已启用' : '规则已禁用');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换规则状态失败');
    }
  };

  const handleRemoveRule = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!confirm(`确认删除规则「${rule?.name || id}」？`)) return;
    setError(null);
    try {
      await window.api.automation.removeRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除规则失败');
    }
  };

  const handleRunRule = async (id: string) => {
    setError(null);
    try {
      const result = await window.api.automation.runRule(id);
      if (result && !result.success) {
        setError(result.error || '运行规则失败');
      }
      const execList = await window.api.automation.getExecutions();
      setExecutions(execList || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '运行规则失败');
    }
  };

  const handleAddFromTemplate = async (template: { name: string; trigger: AutomationRule['trigger']; action: AutomationRule['action'] }) => {
    setError(null);
    try {
      await window.api.automation.addRule(template);
      await loadData();
      setSuccessMsg(`规则「${template.name}」已创建`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加规则失败');
    }
  };

  const templates = [
    { name: '代码审查', trigger: { type: 'file-change' as const, config: {} }, action: { type: 'run-prompt' as const, config: { prompt: '审查最近的代码变更' } } },
    { name: '自动测试', trigger: { type: 'manual' as const, config: {} }, action: { type: 'run-tool' as const, config: { tool: 'shell-exec', args: { command: 'npm test' } } } },
    { name: '提交规范', trigger: { type: 'manual' as const, config: {} }, action: { type: 'run-prompt' as const, config: { prompt: '检查最近的 commit message 是否符合规范' } } },
    { name: '依赖检查', trigger: { type: 'schedule' as const, config: { interval: '7d' } }, action: { type: 'run-prompt' as const, config: { prompt: '检查项目中过时的依赖' } } },
  ];

  return (
    <div className="workspace-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-subtitle">自动化</div>
          <h1 className="panel-title">自动化规则</h1>
        </div>
        <button className="icon-button" onClick={onClose} title="关闭"><X size={16} /></button>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="error-banner-dismiss" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="success-banner">{successMsg}</div>
      )}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>加载中...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Rules */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Zap size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>规则</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--warning)', color: 'var(--bg-base)', borderRadius: 4, fontWeight: 500 }}>实验性</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{rules.length} 个</span>
            </div>

            {rules.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Zap size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>暂无自动化规则</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>从下方模板创建规则</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rules.map((rule) => (
                  <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-app)' }}>
                    <button
                      onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)' }}
                      title={rule.enabled ? '禁用' : '启用'}
                    >
                      {rule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: rule.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{rule.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                        <span>{TRIGGER_LABELS[rule.trigger.type] || rule.trigger.type}</span>
                        <span>·</span>
                        <span>{ACTION_LABELS[rule.action.type] || rule.action.type}</span>
                      </div>
                    </div>
                    <button className="icon-button" onClick={() => handleRunRule(rule.id)} title="立即运行" disabled={!rule.enabled}>
                      <Play size={13} />
                    </button>
                    <button className="icon-button danger" onClick={() => handleRemoveRule(rule.id)} title="删除">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Plus size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>从模板创建</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {templates.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => handleAddFromTemplate(tpl)}
                  className="template-card"
                >
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{tpl.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{TRIGGER_LABELS[tpl.trigger.type]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Execution History */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock3 size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>最近执行</span>
            </div>

            {executions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Clock3 size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>暂无执行记录</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {executions.slice(0, 20).map((exec) => (
                  <div key={exec.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-app)' }}>
                    {exec.success ? (
                      <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    ) : (
                      <XCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{exec.ruleName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {new Date(exec.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' })}
                    </span>
                    {exec.duration != null && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{exec.duration}ms</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
