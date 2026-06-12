import React, { useState } from 'react';
import type { ToolCallInfo } from '@shared/types';
import { Check, ChevronDown, Loader, X } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import { useToast } from '../common/Toast';

interface ToolCardProps {
  tool: ToolCallInfo;
}

const EDIT_TOOLS = new Set(['edit_file', 'write_file']);

function isDiffOutput(output: string): boolean {
  // Require both --- and +++ file headers followed by @@ hunk markers
  return /^---\s+[ab]\/.+\n\+\+\+\s+[ab]\/.+\n@@/m.test(output)
    || /^---\s+.+\n\+\+\+\s+.+\n@@/m.test(output);
}

export function ToolCard({ tool }: ToolCardProps) {
  const [expanded, setExpanded] = useState(tool.status === 'running');
  const [showFullOutput, setShowFullOutput] = useState(false);
  const [fullOutputContent, setFullOutputContent] = useState<string | null>(null);
  const [loadingFullOutput, setLoadingFullOutput] = useState(false);
  const { toast } = useToast();
  const StatusIcon = { running: Loader, done: Check, error: X }[tool.status];
  const isEditTool = EDIT_TOOLS.has(tool.name);
  const showDiff = tool.output && (isEditTool || isDiffOutput(tool.output));

  return (
    <div className="tool-card">
      <button onClick={() => setExpanded(!expanded)} className="tool-card-header" type="button">
        <StatusIcon className={`tool-status ${tool.status}`} size={13} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-primary">{tool.name}</span>
        {tool.truncated && (
          <span className="rounded px-1 py-0.5 text-[10px] font-medium" style={{ background: 'var(--warning-bg, #fef3c7)', color: 'var(--warning-text, #92400e)' }}>
            [已截断]
          </span>
        )}
        <span className="text-[10px] text-muted">{tool.duration ? `${tool.duration}ms` : ''}</span>
        <ChevronDown className={expanded ? 'rotate-180' : ''} size={13} strokeWidth={1.7} />
      </button>

      {expanded && (
        <div className="tool-card-body">
          {Object.keys(tool.args).length > 0 && (
            <>
              <div className="section-label">Arguments</div>
              <pre>{JSON.stringify(tool.args, null, 2)}</pre>
            </>
          )}
          {showDiff ? (
            <DiffViewer
              diff={tool.output as string}
              title={isEditTool ? (tool.args.path as string || tool.args.file_path as string) : undefined}
            />
          ) : tool.output ? (
            <>
              <div className="section-label flex items-center justify-between">
                <span>Output</span>
                {tool.truncated && (
                  <button
                    type="button"
                    className="text-[10px] underline"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (showFullOutput) {
                        setShowFullOutput(false);
                        return;
                      }
                      if (tool.outputPath && !fullOutputContent) {
                        setLoadingFullOutput(true);
                        try {
                          const content = await (window as unknown as { api?: { tool?: { readOutput: (p: string) => Promise<string> } } }).api?.tool?.readOutput(tool.outputPath);
                          if (content) {
                            setFullOutputContent(content);
                          } else {
                            setFullOutputContent(tool.output || '');
                          }
                        } catch {
                          toast('读取完整输出失败', 'error');
                          setFullOutputContent(tool.output || '');
                        } finally {
                          setLoadingFullOutput(false);
                        }
                      }
                      setShowFullOutput(true);
                    }}
                  >
                    {loadingFullOutput ? '加载中...' : showFullOutput ? '收起完整输出' : '查看完整输出'}
                  </button>
                )}
              </div>
              <pre>{tool.output}</pre>
            </>
          ) : null}
        </div>
      )}

      {/* Full output modal */}
      {showFullOutput && (fullOutputContent || tool.output) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowFullOutput(false)}
        >
          <div
            className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-auto rounded-lg p-4"
            style={{ background: 'var(--bg-primary, #1a1a1a)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{tool.name} — 完整输出</span>
              <button type="button" onClick={() => setShowFullOutput(false)} className="p-1">
                <X size={14} />
              </button>
            </div>
            <pre className="font-mono text-xs whitespace-pre-wrap break-words leading-relaxed">{fullOutputContent || tool.output}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
