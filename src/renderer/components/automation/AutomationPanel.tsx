import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, Play, Clock3, Zap, CheckCircle, XCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import type { AutomationRule, AutomationExecution } from '../../../shared/types';
import { useT } from '../../i18n';
import { useToast } from '../common/Toast';

interface AutomationPanelProps {
  onClose: () => void;
}

export function AutomationPanel({ onClose }: AutomationPanelProps) {
  const t = useT();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [removingRuleId, setRemovingRuleId] = useState<string | null>(null);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);

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
    setTogglingRuleId(id);
    try {
      await window.api.automation.toggleRule(id, enabled);
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
      setSuccessMsg(enabled ? t('automation.ruleEnabled') : t('automation.ruleDisabled'));
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.toggleRuleFailed'));
    } finally {
      setTogglingRuleId(null);
    }
  };

  const handleRemoveRule = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!confirm(t('automation.confirmDelete', { name: rule?.name || id }))) return;
    setError(null);
    setRemovingRuleId(id);
    try {
      await window.api.automation.removeRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast('规则已删除', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.deleteRuleFailed'));
    } finally {
      setRemovingRuleId(null);
    }
  };

  const handleRunRule = async (id: string) => {
    setError(null);
    setRunningRuleId(id);
    try {
      const result = await window.api.automation.runRule(id);
      if (result && !result.success) {
        setError(result.error || t('error.runRuleFailed'));
        toast('规则执行失败', 'error');
      } else {
        toast('规则执行成功', 'success');
      }
      const execList = await window.api.automation.getExecutions();
      setExecutions(execList || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.runRuleFailed'));
      toast('规则执行失败', 'error');
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleAddFromTemplate = async (template: { name: string; trigger: AutomationRule['trigger']; action: AutomationRule['action'] }) => {
    setError(null);
    setIsAddingTemplate(true);
    try {
      await window.api.automation.addRule(template);
      await loadData();
      setSuccessMsg(t('automation.ruleCreated', { name: template.name }));
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.addRuleFailed'));
    } finally {
      setIsAddingTemplate(false);
    }
  };

  const TRIGGER_LABELS: Record<string, string> = {
    'file-change': t('automation.trigger.fileChange'),
    'message-count': t('automation.trigger.messageCount'),
    'manual': t('automation.trigger.manual'),
    'schedule': t('automation.trigger.schedule'),
  };

  const ACTION_LABELS: Record<string, string> = {
    'run-prompt': t('automation.action.runPrompt'),
    'run-tool': t('automation.action.runTool'),
    'notify': t('automation.action.notify'),
  };

  const templates = [
    { name: t('automation.template.codeReview'), trigger: { type: 'file-change' as const, config: {} }, action: { type: 'run-prompt' as const, config: { prompt: '审查最近的代码变更' } } },
    { name: t('automation.template.autoTest'), trigger: { type: 'manual' as const, config: {} }, action: { type: 'run-tool' as const, config: { tool: 'shell-exec', args: { command: 'npm test' } } } },
    { name: t('automation.template.commitLint'), trigger: { type: 'manual' as const, config: {} }, action: { type: 'run-prompt' as const, config: { prompt: '检查最近的 commit message 是否符合规范' } } },
    { name: t('automation.template.depCheck'), trigger: { type: 'schedule' as const, config: { interval: '7d' } }, action: { type: 'run-prompt' as const, config: { prompt: '检查项目中过时的依赖' } } },
  ];

  return (
    <div className="workspace-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-subtitle">{t('automation.subtitle')}</div>
          <h1 className="panel-title">{t('automation.title')}</h1>
        </div>
        <button className="icon-button" onClick={onClose} title={t('common.close')}><X size={16} /></button>
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
        <div style={{ color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>{t('common.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Rules */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Zap size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('automation.rules')}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--warning)', color: 'var(--bg-base)', borderRadius: 4, fontWeight: 500 }}>{t('automation.experimental')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{t('automation.ruleCount', { count: rules.length })}</span>
            </div>

            {rules.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Zap size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>{t('automation.noRules')}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{t('automation.createFromTemplateHint')}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rules.map((rule) => (
                  <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-app)' }}>
                    <button
                      onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                      disabled={togglingRuleId === rule.id}
                      style={{ background: 'none', border: 'none', cursor: togglingRuleId === rule.id ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', color: rule.enabled ? 'var(--accent)' : 'var(--text-muted)', opacity: togglingRuleId === rule.id ? 0.5 : 1 }}
                      title={togglingRuleId === rule.id ? '处理中...' : rule.enabled ? t('automation.disable') : t('automation.enable')}
                    >
                      {togglingRuleId === rule.id ? '...' : rule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: rule.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{rule.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                        <span>{TRIGGER_LABELS[rule.trigger.type] || rule.trigger.type}</span>
                        <span>·</span>
                        <span>{ACTION_LABELS[rule.action.type] || rule.action.type}</span>
                      </div>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => handleRunRule(rule.id)}
                      title={runningRuleId === rule.id ? '运行中...' : t('automation.runNow')}
                      disabled={!rule.enabled || runningRuleId === rule.id}
                      style={{ opacity: runningRuleId === rule.id ? 0.6 : 1 }}
                    >
                      <Play size={13} style={runningRuleId === rule.id ? { animation: 'spin 1s linear infinite' } : undefined} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => handleRemoveRule(rule.id)}
                      disabled={removingRuleId === rule.id}
                      title={removingRuleId === rule.id ? '处理中...' : t('common.delete')}
                      style={{ opacity: removingRuleId === rule.id ? 0.5 : 1, cursor: removingRuleId === rule.id ? 'not-allowed' : 'pointer' }}
                    >
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
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('automation.createFromTemplate')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {templates.map((tpl) => (
                <button
                  key={tpl.name}
                  onClick={() => handleAddFromTemplate(tpl)}
                  disabled={isAddingTemplate}
                  className="template-card"
                  style={{ opacity: isAddingTemplate ? 0.5 : 1, cursor: isAddingTemplate ? 'not-allowed' : 'pointer' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{isAddingTemplate ? '处理中...' : tpl.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{TRIGGER_LABELS[tpl.trigger.type]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Execution History */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock3 size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('automation.recentExecutions')}</span>
            </div>

            {executions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Clock3 size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>{t('automation.noExecutions')}</span>
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
