import React from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useT } from '../../i18n';

export function ThinkingIndicator() {
  const isThinking = useChatStore((s) => s.isThinking);
  const t = useT();

  return (
    <div className="flex items-center gap-2 px-4 py-2 max-w-3xl mx-auto">
      <div className="flex items-center gap-1">
        <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--text-muted)' }} />
        <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--text-muted)', animationDelay: '0.15s' }} />
        <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--text-muted)', animationDelay: '0.3s' }} />
      </div>
      <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
        {isThinking ? t('chat.thinking') : t('chat.streaming')}
      </span>
    </div>
  );
}
