import React from 'react';
import { useConfigStore } from '../../stores/configStore';

const MODES = [
  { id: 'suggest' as const, name: '建议模式', description: '执行操作前尽量请求确认，适合审查和探索。' },
  { id: 'auto-edit' as const, name: '自动编辑', description: '允许自动读写文件，命令和高风险操作仍会更谨慎。' },
  { id: 'full-auto' as const, name: '全自动', description: '自动执行大多数操作，破坏性操作仍需确认。' },
];

export function PermissionMode() {
  const { config, setConfig } = useConfigStore();

  return (
    <div className="space-y-1.5">
      {MODES.map((mode) => {
        const isActive = config.permissionMode === mode.id;
        return (
          <label key={mode.id}
            className="flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors duration-150"
            style={{
              background: isActive ? 'var(--bg-hover)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--border-default)' : 'transparent'}`,
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
            <input type="radio" name="permissionMode" value={mode.id}
              checked={isActive}
              onChange={(e) => setConfig({ permissionMode: e.target.value as 'suggest' | 'auto-edit' | 'full-auto' })}
              className="mt-0.5" style={{ accentColor: 'var(--accent)' }} />
            <div>
              <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{mode.name}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{mode.description}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
