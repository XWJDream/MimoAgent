import React, { useState, useCallback } from 'react';
import { GitCompareArrows, Check, X, RotateCcw, AlertTriangle } from 'lucide-react';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface DiffViewerProps {
  diff: string;
  title?: string;
  onAccept?: () => void;
  onReject?: () => void;
}

function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLine = parseInt(match[1]) - 1;
        newLine = parseInt(match[2]) - 1;
      }
      continue;
    }
    // Skip unified diff file headers
    if (line.startsWith('---') || line.startsWith('+++')) continue;

    if (line.startsWith('+')) {
      newLine++;
      result.push({ type: 'add', content: line.slice(1), newLine });
    } else if (line.startsWith('-')) {
      oldLine++;
      result.push({ type: 'remove', content: line.slice(1), oldLine });
    } else {
      oldLine++;
      newLine++;
      result.push({ type: 'context', content: line.slice(1) || '', oldLine, newLine });
    }
  }
  return result;
}

function extractFilePath(diff: string): string | null {
  const match = diff.match(/^---\s+[ab]\/(.+)$/m);
  if (match) return match[1];
  const match2 = diff.match(/^---\s+(.+)$/m);
  if (match2 && !match2[1].startsWith('/dev/null')) return match2[1];
  return null;
}

export function DiffViewer({ diff, title, onAccept, onReject }: DiffViewerProps) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [showConfirm, setShowConfirm] = useState(false);
  const lines = parseDiff(diff);
  const filePath = extractFilePath(diff);

  const handleAccept = useCallback(() => {
    setStatus('accepted');
    onAccept?.();
  }, [onAccept]);

  const handleReject = useCallback(() => {
    setStatus('rejected');
    onReject?.();
  }, [onReject]);

  const handleRejectClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmReject = useCallback(() => {
    setShowConfirm(false);
    handleReject();
  }, [handleReject]);

  const handleCancelReject = useCallback(() => {
    setShowConfirm(false);
  }, []);

  const statusColor = status === 'accepted' ? 'var(--success)' : status === 'rejected' ? 'var(--error)' : 'var(--text-muted)';
  const statusLabel = status === 'accepted' ? '已接受' : status === 'rejected' ? '已拒绝' : '';

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ background: 'var(--bg-surface, var(--bg-secondary))', borderBottom: '1px solid var(--border-subtle)' }}>
        <GitCompareArrows size={13} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
        <span className="text-[12px] font-mono flex-1" style={{ color: 'var(--text-primary)' }}>
          {title || filePath || 'Diff'}
        </span>

        {status === 'pending' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleRejectClick}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors duration-150"
              style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.08)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              <X size={12} strokeWidth={2} />
              拒绝
            </button>
            <button
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors duration-150"
              style={{ color: 'var(--success)', background: 'rgba(16,163,127,0.08)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,163,127,0.16)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,163,127,0.08)'; }}
            >
              <Check size={12} strokeWidth={2} />
              接受
            </button>
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: statusColor }}>
            {status === 'accepted' ? <Check size={12} strokeWidth={2} /> : <RotateCcw size={12} strokeWidth={2} />}
            {statusLabel}
          </span>
        )}
      </div>

      {/* Confirm reject dialog */}
      {showConfirm && (
        <div className="flex items-center gap-2 px-3 py-2 text-[12px]"
          style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid var(--border-subtle)' }}>
          <AlertTriangle size={13} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
            确认拒绝？此操作不会自动撤销文件更改。
          </span>
          <button
            onClick={handleCancelReject}
            className="px-2 py-0.5 rounded text-[11px]"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
          >
            取消
          </button>
          <button
            onClick={handleConfirmReject}
            className="px-2 py-0.5 rounded text-[11px] font-medium"
            style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.12)' }}
          >
            确认拒绝
          </button>
        </div>
      )}

      {/* Diff lines */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-mono">
          <tbody>
            {lines.map((line, i) => (
              <tr
                key={i}
                style={{
                  background:
                    line.type === 'add'
                      ? 'rgba(16,163,127,0.06)'
                      : line.type === 'remove'
                        ? 'rgba(239,68,68,0.06)'
                        : 'transparent',
                  opacity: status === 'rejected' && line.type === 'add' ? 0.4 : 1,
                }}
              >
                <td
                  className="w-10 px-2 py-0.5 text-right select-none"
                  style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-subtle)' }}
                >
                  {line.oldLine || ''}
                </td>
                <td
                  className="w-10 px-2 py-0.5 text-right select-none"
                  style={{ color: 'var(--text-muted)', borderRight: '1px solid var(--border-subtle)' }}
                >
                  {line.newLine || ''}
                </td>
                <td className="px-2 py-0.5">
                  <span
                    style={{
                      color:
                        line.type === 'add'
                          ? 'var(--success)'
                          : line.type === 'remove'
                            ? 'var(--error)'
                            : 'var(--text-muted)',
                    }}
                  >
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{line.content}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
