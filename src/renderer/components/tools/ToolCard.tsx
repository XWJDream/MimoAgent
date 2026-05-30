import React, { useState } from 'react';
import type { ToolCallInfo } from '@shared/types';
import { Check, ChevronDown, Loader, X } from 'lucide-react';
import { DiffViewer } from './DiffViewer';

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
  const StatusIcon = { running: Loader, done: Check, error: X }[tool.status];
  const isEditTool = EDIT_TOOLS.has(tool.name);
  const showDiff = tool.output && (isEditTool || isDiffOutput(tool.output));

  return (
    <div className="tool-card">
      <button onClick={() => setExpanded(!expanded)} className="tool-card-header" type="button">
        <StatusIcon className={`tool-status ${tool.status}`} size={13} strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-primary">{tool.name}</span>
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
              diff={tool.output!}
              title={isEditTool ? (tool.args.path as string || tool.args.file_path as string) : undefined}
            />
          ) : tool.output ? (
            <>
              <div className="section-label">Output</div>
              <pre>{tool.output}</pre>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
