import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FolderSearch, Wrench, Rocket } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useT } from '../../i18n';

export function MessageList() {
  const t = useT();
  const messages = useChatStore((s) => s.messages);
  const currentResponse = useChatStore((s) => s.currentResponse);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { sessions, activeSessionId } = useSessionStore();
  const _activeSession = sessions.find((s) => s.id === activeSessionId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => [
    { icon: FolderSearch, title: t('chat.suggestion.analyzeProject'), desc: t('chat.suggestion.analyzeProjectDesc'), prompt: t('chat.suggestion.analyzeProjectPrompt') },
    { icon: Wrench, title: t('chat.suggestion.fixIssue'), desc: t('chat.suggestion.fixIssueDesc'), prompt: t('chat.suggestion.fixIssuePrompt') },
    { icon: Rocket, title: t('chat.suggestion.generateFeature'), desc: t('chat.suggestion.generateFeatureDesc'), prompt: t('chat.suggestion.generateFeaturePrompt') },
  ], [t]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentResponse]);

  const handleSuggestion = useCallback((prompt: string) => {
    window.dispatchEvent(new CustomEvent('mimo:set-input', { detail: prompt }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mimo:submit-input'));
    }, 50);
  }, []);

  const handleResend = useCallback((content: string) => {
    window.dispatchEvent(new CustomEvent('mimo:set-input', { detail: content }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('mimo:submit-input'));
    }, 50);
  }, []);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="empty-state">
        <h1 className="empty-state-title">{t('chat.welcome')}</h1>
        <p className="empty-state-subtitle">{t('chat.welcomeDesc')}</p>
        <p className="empty-state-desc">{t('chat.welcomeFeatures')}</p>

        <div className="suggestions-grid">
          {suggestions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.title} onClick={() => handleSuggestion(item.prompt)} className="suggestion-card">
                <Icon size={18} strokeWidth={1.7} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div>
                  <div className="suggestion-card-title">{item.title}</div>
                  <div className="suggestion-card-desc">{item.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="space-y-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onResend={handleResend} />
          ))}
          {isStreaming && currentResponse && (
            <MessageBubble
              message={{
                id: 'streaming',
                role: 'assistant',
                content: currentResponse,
                timestamp: Date.now(),
              }}
              isStreaming
              onResend={handleResend}
            />
          )}
        </div>
      </div>
    </div>
  );
}
