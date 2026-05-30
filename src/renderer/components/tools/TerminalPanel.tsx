import React, { useRef, useEffect } from 'react';

interface TerminalPanelProps { output: string; title?: string; isError?: boolean; }

export function TerminalPanel({ output, title, isError }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [output]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--error)' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
        </div>
        <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{title || 'Terminal'}</span>
      </div>
      <div ref={scrollRef} className="p-2.5 max-h-64 overflow-y-auto font-mono text-[11px]">
        {output.split('\n').map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-words"
            style={{ color: isError ? 'var(--error)' : 'var(--text-secondary)' }}>{line}</div>
        ))}
      </div>
    </div>
  );
}
