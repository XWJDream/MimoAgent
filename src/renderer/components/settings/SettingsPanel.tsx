import React, { useState } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { ModelSelector } from './ModelSelector';
import { PermissionMode } from './PermissionMode';
import { X, Moon, Sun } from 'lucide-react';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { config, setConfig, validateApi } = useConfigStore();
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState(config.apiBase);

  if (!isOpen) return null;

  const handleSave = () => {
    setConfig({
      apiBase,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    });
    setApiKey('');
    onClose();
    // Re-validate after saving
    setTimeout(() => validateApi(), 300);
  };

  const handleClearApiKey = () => {
    setConfig({ apiKey: '' });
    setApiKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-xl shadow-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>设置</h2>
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>模型</label>
            <ModelSelector />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>API 地址</label>
            <input type="text" value={apiBase} onChange={(e) => setApiBase(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none transition-colors duration-150"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              placeholder="https://api.xiaomimimo.com/v1" />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>API 密钥</label>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px]" style={{ color: config.apiKeyConfigured ? 'var(--success)' : 'var(--warning)' }}>
                {config.apiKeyConfigured ? `已配置：${config.apiKeyPreview}` : '未配置'}
              </span>
              {config.apiKeyConfigured && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="text-[11px] rounded px-1.5 py-0.5 transition-colors duration-150"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  清除
                </button>
              )}
            </div>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none transition-colors duration-150"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              placeholder={config.apiKeyConfigured ? '留空则保持当前密钥不变' : '输入 API Key'} />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>权限模式</label>
            <PermissionMode />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>工具模式</label>
            <div className="flex gap-2">
              {([['plan', '分析模式', '仅可读取和搜索，适合代码分析'], ['act', '操作模式', '完整工具集，可读写和执行']] as const).map(([value, label, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setConfig({ toolPreset: value })}
                  className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150"
                  style={{
                    flex: 1,
                    background: config.toolPreset === value ? 'var(--accent)' : 'var(--bg-base)',
                    color: config.toolPreset === value ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${config.toolPreset === value ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <span>{label}</span>
                  <span className="text-[10px] opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              温度 ({config.temperature})
            </label>
            <input type="range" min="0" max="2" step="0.1" value={config.temperature}
              onChange={(e) => setConfig({ temperature: parseFloat(e.target.value) })}
              className="w-full" style={{ accentColor: 'var(--accent)' }} />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>最大轮次</label>
            <input type="number" min="1" max="200" value={config.maxTurns}
              onChange={(e) => setConfig({ maxTurns: parseInt(e.target.value) })}
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none transition-colors duration-150"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>沙盒模式</label>
            <button
              type="button"
              onClick={() => setConfig({ sandboxEnabled: !config.sandboxEnabled })}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors duration-150"
              style={{
                background: 'var(--bg-base)',
                border: `1px solid ${config.sandboxEnabled ? 'var(--accent)' : 'var(--border-subtle)'}`,
                color: config.sandboxEnabled ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <span>{config.sandboxEnabled ? '已启用' : '已关闭'}</span>
              <span className="text-[10px] opacity-70">需要 Docker，命令在隔离容器中执行</span>
            </button>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>主题</label>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setConfig({ theme })}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150"
                  style={{
                    flex: 1,
                    background: config.theme === theme ? 'var(--accent)' : 'var(--bg-base)',
                    color: config.theme === theme ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${config.theme === theme ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  }}
                >
                  {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                  {theme === 'dark' ? '深色' : '浅色'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose}
            className="px-3 py-1.5 text-[13px] rounded-lg transition-colors duration-150"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            取消
          </button>
          <button onClick={handleSave}
            className="px-3 py-1.5 text-[13px] text-white rounded-lg transition-colors duration-150"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
