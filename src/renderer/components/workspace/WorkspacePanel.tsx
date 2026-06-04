import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileTreeNode, WorkspaceInfo } from '../../../shared/types';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, RefreshCw, X } from 'lucide-react';
import { highlightCode } from '../../lib/highlighter';
import { useT } from '../../i18n';
import DOMPurify from 'dompurify';

type WorkspacePanelMode = 'workspace' | 'files';

interface WorkspacePanelProps {
  mode: WorkspacePanelMode;
  onClose?: () => void;
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
  const t = useT();
  return (
    <section className="workspace-panel">
      <div className="workspace-toolbar">
        <div className="min-w-0">
          <div className="workspace-kicker">{t('workspace.local')}</div>
          <h1 className="workspace-title">{workspace?.name || t('workspace.notSelected')}</h1>
        </div>
        <div className="workspace-actions">
          <button className="secondary-command" onClick={onRefresh} type="button" disabled={loading} title={t('workspace.refresh')}>
            <RefreshCw size={15} />
            {t('workspace.refresh')}
          </button>
          <button className="primary-command compact" onClick={onSelectWorkspace} type="button">
            {t('workspace.selectDirectory')}
          </button>
        </div>
      </div>

      <div className="workspace-path-block">
        <div className="section-label flush">{t('workspace.currentPath')}</div>
        <div className="workspace-path">{workspace?.path || t('workspace.waiting')}</div>
      </div>

      {error && <div className="workspace-error">{error}</div>}

      <div className="workspace-grid">
        <div className="workspace-stat">
          <span>{t('workspace.status')}</span>
          <strong>{loading ? t('workspace.statusReading') : workspace ? t('workspace.statusConnected') : t('workspace.statusNotConnected')}</strong>
        </div>
        <div className="workspace-stat">
          <span>{t('workspace.entry')}</span>
          <strong>{t('workspace.entryMethod')}</strong>
        </div>
      </div>
    </section>
  );
}

function FileTree({
  nodes,
  selectedPath,
  onSelectFile,
  openPaths,
  onToggleDirectory,
}: {
  nodes: FileTreeNode[];
  selectedPath: string | null;
  onSelectFile: (node: FileTreeNode) => void;
  openPaths: Set<string>;
  onToggleDirectory: (path: string) => void;
}) {
  const toggleDirectory = onToggleDirectory;

  const renderNode = (node: FileTreeNode, depth = 0) => {
    const isDirectory = node.type === 'directory';
    const isOpen = openPaths.has(node.path);
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
  openPaths,
  onToggleDirectory,
  onClose,
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
  openPaths: Set<string>;
  onToggleDirectory: (path: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const previewLines = useMemo(() => preview?.content.split(/\r?\n/).slice(0, 400).join('\n') || '', [preview]);
  const [highlightedHtml, setHighlightedHtml] = useState<string>('');
  const ext = useMemo(() => {
    if (!preview?.name) return '';
    const dot = preview.name.lastIndexOf('.');
    return dot >= 0 ? preview.name.slice(dot + 1) : '';
  }, [preview?.name]);

  useEffect(() => {
    if (!previewLines || !ext) { setHighlightedHtml(''); return; }
    let cancelled = false;
    highlightCode(previewLines, ext).then((html: string) => {
      if (!cancelled) setHighlightedHtml(html);
    });
    return () => { cancelled = true; };
  }, [previewLines, ext]);

  return (
    <section className="workspace-panel files-mode">
      <div className="workspace-toolbar">
        <div className="min-w-0">
          <div className="workspace-kicker">{t('workspace.projectFiles')}</div>
          <h1 className="workspace-title">{workspace?.name || t('workspace.notSelected')}</h1>
        </div>
        <div className="workspace-actions">
          <button className="secondary-command" onClick={onRefreshFiles} type="button" disabled={loading} title={t('workspace.refreshFileTree')}>
            <RefreshCw size={15} />
            {t('workspace.refresh')}
          </button>
          <button className="primary-command compact" onClick={onSelectWorkspace} type="button">
            {t('workspace.selectDirectory')}
          </button>
          <button className="icon-button" onClick={onClose} type="button" title={t('workspace.backToChat')}>
            <X size={16} />
          </button>
        </div>
      </div>

      {error && <div className="workspace-error">{error}</div>}

      <div className="file-workbench">
        <div className="file-browser">
          <div className="file-browser-header">
            <span className="truncate">{workspace ? shortPath(workspace.path) : t('workspace.noWorkspace')}</span>
          </div>
          {loading ? <div className="empty-rail">{t('workspace.loading')}</div> : null}
          {!loading && files.length === 0 ? <div className="empty-rail">{t('workspace.noFiles')}</div> : null}
          {!loading && files.length > 0 ? (
            <FileTree nodes={files} selectedPath={selectedPath} onSelectFile={onSelectFile} openPaths={openPaths} onToggleDirectory={onToggleDirectory} />
          ) : null}
        </div>

        <div className="file-preview">
          <div className="file-preview-header">
            <FileText size={15} />
            <span className="truncate">{preview?.name || t('workspace.selectFilePreview')}</span>
          </div>
          {preview ? (
            highlightedHtml ? (
              <div
                className="file-content"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedHtml) }}
              />
            ) : (
              <pre className="file-content">{previewLines}</pre>
            )
          ) : (
            <div className="file-preview-empty">{t('workspace.selectFileHint')}</div>
          )}
        </div>
      </div>
    </section>
  );
}

export function WorkspacePanel({ mode, onClose }: WorkspacePanelProps) {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPaths, setOpenPaths] = useState<Set<string>>(() => new Set());

  const t = useT();

  // LRU file content cache (max 50 entries)
  const fileCacheRef = useRef(new Map<string, string>());
  const cacheOrderRef = useRef<string[]>([]);

  const getCachedFile = useCallback((path: string): string | undefined => {
    const cache = fileCacheRef.current;
    if (!cache.has(path)) return undefined;
    // Move to end (most recently used)
    const order = cacheOrderRef.current;
    const idx = order.indexOf(path);
    if (idx >= 0) order.splice(idx, 1);
    order.push(path);
    return cache.get(path);
  }, []);

  const setCachedFile = useCallback((path: string, content: string) => {
    const cache = fileCacheRef.current;
    const order = cacheOrderRef.current;
    if (cache.has(path)) {
      cache.set(path, content);
      const idx = order.indexOf(path);
      if (idx >= 0) order.splice(idx, 1);
      order.push(path);
    } else {
      cache.set(path, content);
      order.push(path);
      // Evict oldest if over limit
      while (order.length > 50) {
        const evict = order.shift()!;
        cache.delete(evict);
      }
    }
  }, []);

  const handleToggleDirectory = useCallback((path: string) => {
    setOpenPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    setError(null);
    try {
      const nextWorkspace = await window.api.workspace.get();
      setWorkspace(nextWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.readWorkspaceFailed'));
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
      // Auto-expand root directories
      const rootDirs = new Set<string>();
      for (const node of nextFiles) {
        if (node.type === 'directory') rootDirs.add(node.path);
      }
      setOpenPaths(rootDirs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.readProjectFilesFailed'));
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
      setOpenPaths(new Set());
      fileCacheRef.current.clear();
      cacheOrderRef.current = [];
      const nextFiles = await window.api.files.list(nextWorkspace.path);
      setFiles(nextFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.selectWorkspaceFailed'));
    }
  }, []);

  const handleSelectFile = useCallback(async (node: FileTreeNode) => {
    setSelectedPath(node.path);
    setError(null);
    // Check cache first
    const cached = getCachedFile(node.path);
    if (cached !== undefined) {
      setPreview({ path: node.path, name: node.name, content: cached });
      return;
    }
    try {
      const content = await window.api.files.read(node.path);
      setCachedFile(node.path, content);
      setPreview({ path: node.path, name: node.name, content });
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : t('error.previewFileFailed'));
    }
  }, [getCachedFile, setCachedFile]);

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
      openPaths={openPaths}
      onToggleDirectory={handleToggleDirectory}
      onClose={onClose || (() => {})}
    />
  );
}
