import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileTreeNode, WorkspaceInfo } from '../../../shared/types';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, RefreshCw } from 'lucide-react';

type WorkspacePanelMode = 'workspace' | 'files';

interface WorkspacePanelProps {
  mode: WorkspacePanelMode;
}

type FilePreview = {
  path: string;
  name: string;
  content: string;
};

function shortPath(path: string): string {
  return path.replace(/\\/g, '/');
}

function WorkspaceSummary({
  workspace,
  loading,
  error,
  onSelectWorkspace,
  onRefresh,
}: {
  workspace: WorkspaceInfo | null;
  loading: boolean;
  error: string | null;
  onSelectWorkspace: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="workspace-panel">
      <div className="workspace-toolbar">
        <div className="min-w-0">
          <div className="workspace-kicker">本地工作区</div>
          <h1 className="workspace-title">{workspace?.name || '未选择工作区'}</h1>
        </div>
        <div className="workspace-actions">
          <button className="secondary-command" onClick={onRefresh} type="button" disabled={loading} title="刷新">
            <RefreshCw size={15} />
            刷新
          </button>
          <button className="primary-command compact" onClick={onSelectWorkspace} type="button">
            选择目录
          </button>
        </div>
      </div>

      <div className="workspace-path-block">
        <div className="section-label flush">当前路径</div>
        <div className="workspace-path">{workspace?.path || '等待选择目录'}</div>
      </div>

      {error && <div className="workspace-error">{error}</div>}

      <div className="workspace-grid">
        <div className="workspace-stat">
          <span>状态</span>
          <strong>{loading ? '读取中' : workspace ? '已连接' : '未连接'}</strong>
        </div>
        <div className="workspace-stat">
          <span>入口</span>
          <strong>侧边栏切换</strong>
        </div>
      </div>
    </section>
  );
}

function FileTree({
  nodes,
  selectedPath,
  onSelectFile,
}: {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelectFile: (node: FileTreeNode) => void;
}) {
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set());

  const toggleDirectory = (path: string) => {
    setOpenPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: FileTreeNode, depth = 0) => {
    const isDirectory = node.type === 'directory';
    const isOpen = openPaths.has(node.path) || depth < 1;
    const isSelected = selectedPath === node.path;
    const children = node.children || [];

    return (
      <div key={node.path}>
        <button
          className={`file-tree-row ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => (isDirectory ? toggleDirectory(node.path) : onSelectFile(node))}
          type="button"
          title={node.path}
        >
          {isDirectory ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <span className="file-tree-spacer" />
          )}
          {isDirectory ? (
            isOpen ? <FolderOpen size={15} /> : <Folder size={15} />
          ) : (
            <FileText size={15} />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isDirectory && isOpen && children.length > 0 && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return <div className="file-tree">{nodes.map((node) => renderNode(node))}</div>;
}

function FileExplorer({
  workspace,
  files,
  loading,
  error,
  preview,
  selectedPath,
  onSelectWorkspace,
  onRefreshFiles,
  onSelectFile,
}: {
  workspace: WorkspaceInfo | null;
  files: FileTreeNode[];
  loading: boolean;
  error: string | null;
  preview: FilePreview | null;
  selectedPath: string | null;
  onSelectWorkspace: () => void;
  onRefreshFiles: () => void;
  onSelectFile: (node: FileTreeNode) => void;
}) {
  const previewLines = useMemo(() => preview?.content.split(/\r?\n/).slice(0, 400).join('\n') || '', [preview]);

  return (
    <section className="workspace-panel files-mode">
      <div className="workspace-toolbar">
        <div className="min-w-0">
          <div className="workspace-kicker">项目文件</div>
          <h1 className="workspace-title">{workspace?.name || '未选择工作区'}</h1>
        </div>
        <div className="workspace-actions">
          <button className="secondary-command" onClick={onRefreshFiles} type="button" disabled={loading} title="刷新文件树">
            <RefreshCw size={15} />
            刷新
          </button>
          <button className="primary-command compact" onClick={onSelectWorkspace} type="button">
            选择目录
          </button>
        </div>
      </div>

      {error && <div className="workspace-error">{error}</div>}

      <div className="file-workbench">
        <div className="file-browser">
          <div className="file-browser-header">
            <span className="truncate">{workspace ? shortPath(workspace.path) : '暂无工作区'}</span>
          </div>
          {loading ? <div className="empty-rail">正在读取文件树...</div> : null}
          {!loading && files.length === 0 ? <div className="empty-rail">没有可展示的文件。</div> : null}
          {!loading && files.length > 0 ? (
            <FileTree nodes={files} selectedPath={selectedPath} onSelectFile={onSelectFile} />
          ) : null}
        </div>

        <div className="file-preview">
          <div className="file-preview-header">
            <FileText size={15} />
            <span className="truncate">{preview?.name || '选择文件预览'}</span>
          </div>
          {preview ? (
            <pre>{previewLines}</pre>
          ) : (
            <div className="file-preview-empty">从左侧文件树选择一个文件。</div>
          )}
        </div>
      </div>
    </section>
  );
}

export function WorkspacePanel({ mode }: WorkspacePanelProps) {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    setError(null);
    try {
      const nextWorkspace = await window.api.workspace.get();
      setWorkspace(nextWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取工作区失败');
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    setError(null);
    try {
      const nextWorkspace = await window.api.workspace.get();
      const nextFiles = await window.api.files.list(nextWorkspace.path);
      setWorkspace(nextWorkspace);
      setFiles(nextFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取项目文件失败');
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const handleSelectWorkspace = useCallback(async () => {
    setError(null);
    try {
      const nextWorkspace = await window.api.workspace.select();
      if (!nextWorkspace) return;
      setWorkspace(nextWorkspace);
      setPreview(null);
      setSelectedPath(null);
      const nextFiles = await window.api.files.list(nextWorkspace.path);
      setFiles(nextFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : '选择工作区失败');
    }
  }, []);

  const handleSelectFile = useCallback(async (node: FileTreeNode) => {
    setSelectedPath(node.path);
    setError(null);
    try {
      const content = await window.api.files.read(node.path);
      setPreview({ path: node.path, name: node.name, content });
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : '预览文件失败');
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (mode === 'files') loadFiles();
  }, [loadFiles, mode]);

  if (mode === 'workspace') {
    return (
      <WorkspaceSummary
        workspace={workspace}
        loading={loadingWorkspace}
        error={error}
        onSelectWorkspace={handleSelectWorkspace}
        onRefresh={loadWorkspace}
      />
    );
  }

  return (
    <FileExplorer
      workspace={workspace}
      files={files}
      loading={loadingFiles}
      error={error}
      preview={preview}
      selectedPath={selectedPath}
      onSelectWorkspace={handleSelectWorkspace}
      onRefreshFiles={loadFiles}
      onSelectFile={handleSelectFile}
    />
  );
}
