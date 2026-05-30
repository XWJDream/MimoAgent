import React, { useCallback, useEffect, useRef } from 'react';
import { FolderSearch, Wrench, Rocket, GitBranch } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';

const suggestions = [
  { icon: FolderSearch, title: '分析项目', desc: '理解代码结构与模块关系', prompt: '请分析这个项目的结构、主要模块和智能体调用链。' },
  { icon: Wrench, title: '修复问题', desc: '定位并修复高优先级 Bug', prompt: '请检查当前项目，找一个高优先级问题并修复。' },
  { icon: Rocket, title: '生成功能', desc: '基于需求编写新代码', prompt: '请根据项目需求，实现一个新的核心功能模块。' },
];

const recentProjects = [
  { name: 'DiaCOQE', branch: 'main' },
  { name: 'MimoAgent', branch: 'dev' },
  { name: 'WebCrawler', branch: 'master' },
  { name: 'PaperReproduce', branch: 'main' },
];

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const currentResponse = useChatStore((s) => s.currentResponse);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { sessions, activeSessionId } = useSessionStore();
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="empty-state">
        <h1 className="empty-state-title">欢迎来到 MimoAgent</h1>
        <p className="empty-state-subtitle">你的 AI 开发助手</p>
        <p className="empty-state-desc">支持代码生成、调试、重构与项目分析</p>

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

        <div className="recent-projects">
          {recentProjects.map((proj) => (
            <div key={proj.name} className="recent-project-card">
              <GitBranch size={14} strokeWidth={1.7} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{proj.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{proj.branch}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="space-y-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
