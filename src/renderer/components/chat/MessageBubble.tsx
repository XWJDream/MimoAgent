import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Message } from '@shared/types';
import { highlightCode } from '../../lib/highlighter';

marked.setOptions({ breaks: true, gfm: true });

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUser || !contentRef.current) return;

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
      btn.title = '复制代码';
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
  }, [message.content, isUser]);

  const sanitizedHtml = isUser ? '' : DOMPurify.sanitize(marked.parse(message.content) as string);

  if (isTool) {
    return (
      <article className="message-row">
        <div className="min-w-0 flex-1">
          <div className="mb-1">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Tool Result</span>
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
          <span className="whitespace-pre-wrap break-words leading-relaxed text-sm">{message.content}</span>
          <div className="mt-1 text-right text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(message.timestamp)}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="message-row">
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
        <div className="mb-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>MimoAgent</span>
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
              {message.usage.tokens.toLocaleString()} tokens · ${message.usage.cost.toFixed(4)}
            </div>
          )}
          <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(message.timestamp)}</div>
        </div>
      </div>
    </article>
  );
}
