import React, { useEffect, useRef, useState, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Message } from '@shared/types';
import { highlightCode } from '../../lib/highlighter';
import { useChatStore } from '../../stores/chatStore';
import { Pencil, RotateCcw, Copy, Check } from 'lucide-react';
import { useT, t } from '../../i18n';

marked.setOptions({ breaks: true, gfm: true });

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onResend?: (content: string) => void;
}

export function MessageBubble({ message, isStreaming, onResend }: MessageBubbleProps) {
  const t = useT();
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';
  const contentRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const editAndResend = useChatStore((s) => s.editAndResend);
  const regenerateFrom = useChatStore((s) => s.regenerateFrom);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [message.content]);

  const handleEdit = useCallback(() => {
    if (editing) {
      // Save and resend
      const prompt = editAndResend(message.id, editContent);
      if (prompt && onResend) {
        onResend(prompt);
      }
      setEditing(false);
    } else {
      setEditContent(message.content);
      setEditing(true);
    }
  }, [editing, editContent, message.id, message.content, editAndResend, onResend]);

  const handleRegenerate = useCallback(() => {
    const prompt = regenerateFrom(message.id);
    if (prompt && onResend) {
      onResend(prompt);
    }
  }, [message.id, regenerateFrom, onResend]);

  useEffect(() => {
    if (isUser || !contentRef.current || editing) return;

    let cancelled = false;
    const el = contentRef.current;
    const codeBlocks = el.querySelectorAll('pre > code');
    const timers: ReturnType<typeof setTimeout>[] = [];

    codeBlocks.forEach((codeEl) => {
      const pre = codeEl.parentElement as HTMLPreElement;
      if (!pre || pre.dataset.enhanced === 'true') return;
      pre.dataset.enhanced = 'true';

      const langClass = Array.from(codeEl.classList).find((c) => c.startsWith('language-'));
      const lang = langClass ? langClass.replace('language-', '') : '';
      const code = codeEl.textContent || '';

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      btn.title = t('chat.copyCode');
      btn.onclick = () => {
        navigator.clipboard.writeText(code).then(() => {
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
          btn.classList.add('copied');
          const timer = setTimeout(() => {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
            btn.classList.remove('copied');
          }, 2000);
          timers.push(timer);
        }).catch(() => {});
      };
      wrapper.appendChild(btn);

      if (lang) {
        const langLabel = document.createElement('span');
        langLabel.className = 'code-lang-label';
        langLabel.textContent = lang;
        wrapper.appendChild(langLabel);
      }

      highlightCode(code, lang).then((html) => {
        if (cancelled || !pre.parentNode) return;
        pre.outerHTML = html;
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [message.content, isUser, editing]);

  const sanitizedHtml = isUser ? '' : DOMPurify.sanitize(marked.parse(message.content) as string);

  if (isTool) {
    return (
      <article className="message-row">
        <div className="min-w-0 flex-1">
          <div className="mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('chat.toolResult')}</span>
          </div>
          <div className="message-body panel">
            <pre className="font-mono text-xs whitespace-pre-wrap break-words leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {message.content}
            </pre>
          </div>
        </div>
      </article>
    );
  }

  if (isUser) {
    return (
      <article className="message-row user">
        <div className="message-body">
          {editing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-y"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--accent)', color: 'var(--text-primary)', minHeight: 60 }}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 mt-1 justify-end">
                <button onClick={() => setEditing(false)} className="text-[11px] px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)' }}>{t('common.cancel')}</button>
                <button onClick={handleEdit} className="text-[11px] px-2 py-0.5 rounded text-white" style={{ background: 'var(--accent)' }}>{t('chat.send')}</button>
              </div>
            </div>
          ) : (
            <>
              <span className="whitespace-pre-wrap break-words leading-relaxed text-sm">{message.content}</span>
              <div className="mt-1 flex items-center justify-between">
                <div className="msg-actions">
                  <button
                    onClick={handleCopy}
                    className={`msg-action-btn ${copied ? 'copied' : ''}`}
                    title={t('common.copy')}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                  <button
                    onClick={handleEdit}
                    className="msg-action-btn"
                    title={t('chat.editAndResend')}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(message.timestamp)}</span>
              </div>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="message-row group">
      <div className="message-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>MimoAgent</span>
          {!isStreaming && !editing && (
            <div className="msg-actions">
              <button
                onClick={handleCopy}
                className={`msg-action-btn ${copied ? 'copied' : ''}`}
                title={t('common.copy')}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
              <button
                onClick={handleRegenerate}
                className="msg-action-btn"
                title={t('chat.regenerate')}
              >
                <RotateCcw size={11} />
              </button>
            </div>
          )}
        </div>
        <div className="message-body">
          <div className="text-sm">
            <div
              ref={contentRef}
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
            {isStreaming && <span className="stream-caret" />}
          </div>
          {message.usage && message.usage.tokens > 0 && (
            <div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {message.usage.tokens.toLocaleString()} tokens
              {message.usage.cachedTokens ? ` · ${t('chat.cacheHit')} ${message.usage.cachedTokens.toLocaleString()}` : ''}
            </div>
          )}
          <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(message.timestamp)}</div>
        </div>
      </div>
    </article>
  );
}
