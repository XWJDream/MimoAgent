import React, { useCallback, useEffect, useState } from 'react';
import { X, Plus, Trash2, Power, Server, Wrench, RefreshCw } from 'lucide-react';
import type { McpServerConfig, ToolInfo } from '../../../shared/types';
import { useT } from '../../i18n';
import { useToast } from '../common/Toast';

interface PluginPanelProps {
  onClose: () => void;
}

export function PluginPanel({ onClose }: PluginPanelProps) {
  const t = useT();
  const { toast } = useToast();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddServer, setShowAddServer] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [removingServerId, setRemovingServerId] = useState<string | null>(null);
  const [togglingServerId, setTogglingServerId] = useState<string | null>(null);

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
    setIsAdding(true);
    try {
      await window.api.mcp.addServer({
        name: newServer.name.trim(),
        command: newServer.command.trim(),
        args: newServer.args.trim() ? newServer.args.trim().split(/\s+/) : [],
      });
      setNewServer({ name: '', command: '', args: '' });
      setShowAddServer(false);
      await loadData();
      setSuccessMsg(t('plugin.serverAdded', { name: newServer.name.trim() }));
      setTimeout(() => setSuccessMsg(null), 2000);
      toast('服务器添加成功', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.addServerFailed'));
      toast('添加失败', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveServer = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!confirm(t('plugin.confirmDelete', { name: server?.name || id }))) return;
    setError(null);
    setRemovingServerId(id);
    try {
      await window.api.mcp.removeServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      toast('服务器已删除', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.deleteServerFailed'));
    } finally {
      setRemovingServerId(null);
    }
  };

  const handleToggleServer = async (id: string, enabled: boolean) => {
    setError(null);
    setTogglingServerId(id);
    try {
      await window.api.mcp.toggleServer(id, enabled);
      setServers((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
      toast(`服务器已${enabled ? '启用' : '禁用'}`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.toggleServerFailed'));
    } finally {
      setTogglingServerId(null);
    }
  };

  const builtinTools = tools.filter((t) => (t.categories as string[]).includes('builtin'));
  const mcpTools = tools.filter((t) => (t.categories as string[]).includes('mcp'));

  return (
    <div className="workspace-panel">
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-subtitle">{t('plugin.title')}</div>
          <h1 className="panel-title">{t('plugin.panelTitle')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="icon-button"
            onClick={loadData}
            disabled={loading}
            title={loading ? '加载中...' : t('common.refresh')}
            style={{ opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={15} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button className="icon-button" onClick={onClose} title={t('common.close')}><X size={16} /></button>
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
        <div style={{ color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>{t('common.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Built-in Tools */}
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Wrench size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('plugin.builtinTools')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{t('plugin.toolCount', { count: builtinTools.length })}</span>
            </div>
            {builtinTools.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Wrench size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>{t('plugin.noBuiltinTools')}</span>
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
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('plugin.mcpTools')}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{t('plugin.toolCount', { count: mcpTools.length })}</span>
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
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t('plugin.mcpServers')}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--warning)', color: 'var(--bg-base)', borderRadius: 4, fontWeight: 500 }}>{t('plugin.experimental')}</span>
              <button
                className="btn-secondary"
                onClick={() => setShowAddServer(!showAddServer)}
                style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}
              >
                <Plus size={13} /> {t('plugin.addServer')}
              </button>
            </div>

            {showAddServer && (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    placeholder={t('plugin.serverName')}
                    value={newServer.name}
                    onChange={(e) => setNewServer((s) => ({ ...s, name: e.target.value }))}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder={t('plugin.commandPlaceholder')}
                    value={newServer.command}
                    onChange={(e) => setNewServer((s) => ({ ...s, command: e.target.value }))}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder={t('plugin.argsPlaceholder')}
                    value={newServer.args}
                    onChange={(e) => setNewServer((s) => ({ ...s, args: e.target.value }))}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setShowAddServer(false)} style={{ fontSize: 12, padding: '4px 10px' }}>{t('common.cancel')}</button>
                    <button className="btn-primary" onClick={handleAddServer} disabled={isAdding} style={{ fontSize: 12, padding: '4px 14px', opacity: isAdding ? 0.6 : 1, cursor: isAdding ? 'not-allowed' : 'pointer' }}>{isAdding ? '处理中...' : t('plugin.add')}</button>
                  </div>
                </div>
              </div>
            )}

            {servers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                <Server size={24} strokeWidth={1.2} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: 12 }}>{t('plugin.noMcpServers')}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{t('plugin.noMcpServersHint')}</span>
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
                    <button
                      className="icon-button"
                      onClick={() => handleToggleServer(server.id, !server.enabled)}
                      disabled={togglingServerId === server.id}
                      title={togglingServerId === server.id ? '处理中...' : server.enabled ? t('plugin.disable') : t('plugin.enable')}
                      style={{ opacity: togglingServerId === server.id ? 0.5 : 1, cursor: togglingServerId === server.id ? 'not-allowed' : 'pointer' }}
                    >
                      <Power size={13} style={{ color: server.enabled ? 'var(--success)' : 'var(--text-muted)' }} />
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() => handleRemoveServer(server.id)}
                      disabled={removingServerId === server.id}
                      title={removingServerId === server.id ? '处理中...' : t('common.delete')}
                      style={{ opacity: removingServerId === server.id ? 0.5 : 1, cursor: removingServerId === server.id ? 'not-allowed' : 'pointer' }}
                    >
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
