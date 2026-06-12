import React, { useState, useMemo } from 'react';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface DiffViewerProps {
  old: string;
  new: string;
  filePath?: string;
}

type DiffMode = 'unified' | 'split';

/**
 * Compute a simple line-level diff between old and new content.
 * Uses a naive LCS approach for reasonable results without external deps.
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  let i = m;
  let j = n;
  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: 'context', content: oldLines[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'add', content: newLines[j - 1], newLine: j });
      j--;
    } else {
      temp.push({ type: 'remove', content: oldLines[i - 1], oldLine: i });
      i--;
    }
  }

  // Reverse since we backtracked
  for (let k = temp.length - 1; k >= 0; k--) {
    result.push(temp[k]);
  }

  return result;
}

/** Collapse long runs of context lines to show only +-3 around changes */
function collapseContext(lines: DiffLine[], contextSize = 3): (DiffLine | { type: 'separator' })[] {
  const result: (DiffLine | { type: 'separator' })[] = [];
  const changeIndices = new Set<number>();

  lines.forEach((line, idx) => {
    if (line.type !== 'context') {
      for (let c = Math.max(0, idx - contextSize); c <= Math.min(lines.length - 1, idx + contextSize); c++) {
        changeIndices.add(c);
      }
    }
  });

  let lastShown = -1;
  lines.forEach((line, idx) => {
    if (changeIndices.has(idx)) {
      if (lastShown !== -1 && idx - lastShown > 1) {
        result.push({ type: 'separator' });
      }
      result.push(line);
      lastShown = idx;
    }
  });

  return result;
}

/** Statistics summary */
function getStats(lines: DiffLine[]) {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === 'add') added++;
    if (line.type === 'remove') removed++;
  }
  return { added, removed };
}

export function DiffViewer({ old, new: newContent, filePath }: DiffViewerProps) {
  const [mode, setMode] = useState<DiffMode>('unified');
  const [expanded, setExpanded] = useState(false);

  const oldLines = useMemo(() => old.split('\n'), [old]);
  const newLines = useMemo(() => newContent.split('\n'), [newContent]);
  const diff = useMemo(() => computeDiff(oldLines, newLines), [oldLines, newLines]);
  const stats = useMemo(() => getStats(diff), [diff]);

  const displayLines = expanded ? diff : collapseContext(diff);

  const renderLine = (line: DiffLine, index: number) => {
    const bg =
      line.type === 'add'
        ? 'rgba(34,197,94,0.08)'
        : line.type === 'remove'
          ? 'rgba(239,68,68,0.08)'
          : 'transparent';
    const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
    const prefixColor =
      line.type === 'add'
        ? 'var(--success)'
        : line.type === 'remove'
          ? 'var(--error)'
          : 'var(--text-muted)';

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          background: bg,
          lineHeight: 1.7,
        }}
      >
        <span
          style={{
            width: 40,
            textAlign: 'right',
            paddingRight: 8,
            color: 'var(--text-muted)',
            userSelect: 'none',
            flexShrink: 0,
            opacity: 0.6,
          }}
        >
          {line.oldLine ?? ''}
        </span>
        <span
          style={{
            width: 40,
            textAlign: 'right',
            paddingRight: 8,
            color: 'var(--text-muted)',
            userSelect: 'none',
            flexShrink: 0,
            opacity: 0.6,
          }}
        >
          {line.newLine ?? ''}
        </span>
        <span
          style={{
            width: 16,
            color: prefixColor,
            userSelect: 'none',
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {prefix}
        </span>
        <span
          style={{
            flex: 1,
            whiteSpace: 'pre',
            color: 'var(--text-secondary)',
          }}
        >
          {line.content}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-base)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {filePath && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              {filePath}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              color: 'var(--success)',
            }}
          >
            +{stats.added}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--error)',
            }}
          >
            -{stats.removed}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setMode('unified')}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: 'none',
              background: mode === 'unified' ? 'var(--accent)' : 'transparent',
              color: mode === 'unified' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            统一
          </button>
          <button
            onClick={() => setMode('split')}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: 'none',
              background: mode === 'split' ? 'var(--accent)' : 'transparent',
              color: mode === 'split' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            分屏
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              marginLeft: 4,
            }}
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div
        style={{
          maxHeight: expanded ? 'none' : 300,
          overflow: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}
      >
        {mode === 'unified' ? (
          <div>
            {displayLines.map((line, i) =>
              'type' in line && line.type === 'separator' ? (
                <div
                  key={`sep-${i}`}
                  style={{
                    padding: '4px 12px',
                    background: 'var(--bg-base)',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    textAlign: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  ...
                </div>
              ) : (
                renderLine(line as DiffLine, i)
              ),
            )}
          </div>
        ) : (
          /* Split view */
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, borderRight: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  padding: '4px 12px',
                  background: 'var(--bg-base)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                旧内容
              </div>
              {diff
                .filter((l) => l.type !== 'add')
                .map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      background: line.type === 'remove' ? 'rgba(239,68,68,0.08)' : 'transparent',
                      lineHeight: 1.7,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        textAlign: 'right',
                        paddingRight: 8,
                        color: 'var(--text-muted)',
                        userSelect: 'none',
                        flexShrink: 0,
                        opacity: 0.6,
                      }}
                    >
                      {line.oldLine ?? ''}
                    </span>
                    <span
                      style={{
                        width: 16,
                        color: line.type === 'remove' ? 'var(--error)' : 'var(--text-muted)',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                    >
                      {line.type === 'remove' ? '-' : ' '}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'pre', color: 'var(--text-secondary)' }}>
                      {line.content}
                    </span>
                  </div>
                ))}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  padding: '4px 12px',
                  background: 'var(--bg-base)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                新内容
              </div>
              {diff
                .filter((l) => l.type !== 'remove')
                .map((line, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      background: line.type === 'add' ? 'rgba(34,197,94,0.08)' : 'transparent',
                      lineHeight: 1.7,
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        textAlign: 'right',
                        paddingRight: 8,
                        color: 'var(--text-muted)',
                        userSelect: 'none',
                        flexShrink: 0,
                        opacity: 0.6,
                      }}
                    >
                      {line.newLine ?? ''}
                    </span>
                    <span
                      style={{
                        width: 16,
                        color: line.type === 'add' ? 'var(--success)' : 'var(--text-muted)',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                    >
                      {line.type === 'add' ? '+' : ' '}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'pre', color: 'var(--text-secondary)' }}>
                      {line.content}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
