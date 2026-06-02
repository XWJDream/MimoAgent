import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, Power, Server, Wrench, RefreshCw } from 'lucide-react';
import type { McpServerConfig, ToolInfo } from '../../../shared/types';

interface PluginPanelProps {
  onClose: () => void;
}

export function PluginPanel({ onClose }: PluginPanelProps) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [toolList, serverList] = await Promise.all([
        window.api.tools.list(),
        window.api.mcp.getServers(),
      ]);
      setTools(toolList || []);
      setServers(serverList || []);
    } catch (err) {
      console.error('Failed to load plugin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddServer = async () => {
    if (!newServer.name.trim() || !newServer.command.trim()) return;
    setError(null);
    try {
      await window.api.mcp.addServer({
        name: newServer.name.trim(),
        command: newServer.command.trim(),
        args: newServer.args.trim() ? newServer.args.trim().split(/\s+/) : [],
      });
      setNewServer({ name: '', command: '', args: '' });
      setShowAddServer(false);
      await loadData();
      setSuccessMsg(`服务器「${newServer.name.trim()}」已添加`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加服务器失败');
    }
  };

  const handleRemoveServer = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!confirm(`确认删除服务器「${server?.name || id}」？`)) return;
    setError(null);
    try {
      await window.api.mcp.removeServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除服务器失败');
    }
  };

  const handleToggleServer = async (id: string, enabled: boolean) => {
    setError(null);
    try {
      await window.api.mcp.toggleServer(id, enabled);
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换服务器状态失败');
    }
  };

  const builtinTools = tools.filter((t) => (t.categories as string[]).includes('builtin'));
  const mcpTools = tools.filter((t) => (t.categories as string[]).includes('mcp'));

  return (
    <div className="workspace-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-subtitle">插件管理</div>
          <h1 className="panel-title">插件</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-button" onClick={loadData} title="刷新"><RefreshCw size={15} /></button>
          <button className="icon-button" onClick={onClose} title="关闭"><X size={16} /></button>
        </div>
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
          {/* Built-in Tools */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Wrench size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>内置工具</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{builtinTools.length} 个</span>
            </div>
            {builtinTools.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Wrench size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>暂无内置工具</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {builtinTools.map((tool) => (
                  <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-app)' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{tool.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.description}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>{tool.riskLevel}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MCP Tools */}
          {mcpTools.length > 0 && (
            <div className="workspace-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Server size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>MCP 工具</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{mcpTools.length} 个</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {mcpTools.map((tool) => (
                  <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-app)' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{tool.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>{tool.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MCP Servers */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Server size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>MCP 服务器</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--warning)', color: 'var(--bg-base)', borderRadius: 4, fontWeight: 500 }}>实验性</span>
              <button
                className="btn-secondary"
                onClick={() => setShowAddServer(!showAddServer)}
                style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}
              >
                <Plus size={13} /> 添加服务器
              </button>
            </div>

            {showAddServer && (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="服务器名称"
                    value={newServer.name}
                    onChange={(e) => setNewServer((s) => ({ ...s, name: e.target.value }))}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="命令 (如 npx, node)"
                    value={newServer.command}
                    onChange={(e) => setNewServer((s) => ({ ...s, command: e.target.value }))}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="参数 (空格分隔)"
                    value={newServer.args}
                    onChange={(e) => setNewServer((s) => ({ ...s, args: e.target.value }))}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setShowAddServer(false)} style={{ fontSize: 12, padding: '4px 10px' }}>取消</button>
                    <button className="btn-primary" onClick={handleAddServer} style={{ fontSize: 12, padding: '4px 14px' }}>添加</button>
                  </div>
                </div>
              </div>
            )}

            {servers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Server size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>暂无 MCP 服务器配置</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>点击上方按钮添加服务器</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {servers.map((server) => (
                  <div key={server.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-app)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: server.enabled ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{server.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{server.command} {server.args.join(' ')}</div>
                    </div>
                    <button className="icon-button" onClick={() => handleToggleServer(server.id, !server.enabled)} title={server.enabled ? '禁用' : '启用'}>
                      <Power size={13} style={{ color: server.enabled ? 'var(--success)' : 'var(--text-muted)' }} />
                    </button>
                    <button className="icon-button danger" onClick={() => handleRemoveServer(server.id)} title="删除">
                      <Trash2 size={13} />
                    </button>
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
