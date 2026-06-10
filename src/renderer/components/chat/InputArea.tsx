import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, AtSign, Hash, Slash, Square } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { useT } from '../../i18n';
import type { AppConfig } from '../../../shared/types';

const MODELS = [
  { id: 'mimo-v2.5-pro', name: 'MiMo v2.5 Pro' },
  { id: 'mimo-v2.5', name: 'MiMo v2.5' },
  { id: 'mimo-v2.5-tts-voiceclone', name: 'MiMo v2.5 TTS VoiceClone' },
  { id: 'mimo-v2.5-tts-voicedesign', name: 'MiMo v2.5 TTS VoiceDesign' },
  { id: 'mimo-v2.5-tts', name: 'MiMo v2.5 TTS' },
];

export function InputArea() {
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const isSendingRef = useRef(false);
  const {
    addMessage,
    isStreaming,
    setStreaming,
    appendToken,
    setThinking,
    failResponse,
    addToolCall,
    finishToolCall,
    finishResponse,
  } = useChatStore();
  const { config, setConfig } = useConfigStore();
  const t = useT();

  const TEMPERATURES = [
    { value: '0', label: t('input.temperature.exact') },
    { value: '0.2', label: t('input.temperature.low') },
    { value: '0.5', label: t('input.temperature.medium') },
    { value: '1', label: t('input.temperature.high') },
    { value: '1.5', label: t('input.temperature.creative') },
  ];

  const PERMISSION_MODES = [
    { value: 'suggest', label: t('permission.suggest') },
    { value: 'auto-edit', label: t('permission.autoEdit') },
    { value: 'full-auto', label: t('permission.fullAuto') },
  ];

  const REASONING_EFFORTS = [
    { value: 'low', label: t('input.reasoning.low') },
    { value: 'medium', label: t('input.reasoning.medium') },
    { value: 'high', label: t('input.reasoning.high') },
  ];

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isSendingRef.current) return;

    isSendingRef.current = true;

    addMessage({
      id: Date.now().toString(36),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    });

    setInput('');
    setThinking(true);
    setStreaming(true);

    window.api?.agent.run(trimmed).catch((err: Error) => {
      console.error('Agent error:', err);
      failResponse(err.message);
    }).finally(() => {
      isSendingRef.current = false;
    });
  }, [input, isStreaming, addMessage, setStreaming, setThinking, failResponse]);

  handleSubmitRef.current = handleSubmit;

  const handleStop = useCallback(() => {
    window.api?.agent.stop();
    setThinking(false);
    setStreaming(false);
    isSendingRef.current = false;
  }, [setStreaming, setThinking]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.py', '.rs', '.go', '.yaml', '.yml', '.toml', '.txt', '.sh', '.sql'];

    for (const file of files) {
      if (file.size > 1024 * 1024) continue;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (textExtensions.includes(ext)) {
        const content = await file.text();
        setInput(prev => prev + `\n\n--- File: ${file.name} ---\n\`\`\`${ext.slice(1)}\n${content}\n\`\`\``);
      }
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleSetInput = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail;
      if (typeof prompt === 'string') {
        setInput(prompt);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    };
    const handleSubmitInput = () => {
      requestAnimationFrame(() => handleSubmitRef.current());
    };

    window.addEventListener('mimo:set-input', handleSetInput);
    window.addEventListener('mimo:submit-input', handleSubmitInput);
    return () => {
      window.removeEventListener('mimo:set-input', handleSetInput);
      window.removeEventListener('mimo:submit-input', handleSubmitInput);
    };
  }, []);

  useEffect(() => {
    const api = window.api;
    if (!api) return;

    const unsubToken = api.agent.onToken((token: string) => {
      appendToken(token);
      setThinking(false);
    });
    const unsubDone = api.agent.onDone((usage) => {
      finishResponse(usage);
    });
    const unsubError = api.agent.onError((error: string) => {
      console.error('Agent error:', error);
      failResponse(error);
    });
    const unsubToolStart = api.agent.onToolStart((tool) => {
      addToolCall(tool);
    });
    const unsubToolResult = api.agent.onToolResult((result) => {
      finishToolCall(result);
    });
    const unsubThinking = api.agent.onThinking(() => {
      // Ensure streaming mode is activated for automation-triggered runs
      setStreaming(true);
      setThinking(true);
    });

    return () => {
      unsubToken();
      unsubDone();
      unsubError();
      unsubToolStart();
      unsubToolResult();
      unsubThinking();
      api.agent.stop?.();
    };
  }, [appendToken, finishResponse, setThinking, setStreaming, failResponse, addToolCall, finishToolCall]);

  return (
    <div
      className="composer-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed"
             style={{ borderColor: 'var(--accent)', background: 'rgba(59, 130, 246, 0.05)', zIndex: 10 }}>
          <span className="text-sm" style={{ color: 'var(--accent)' }}>{t('chat.dragDrop')}</span>
        </div>
      )}
      <div className="composer">
        {/* Tag bar */}
        <div className="composer-tags">
          <button className="composer-tag" type="button">
            <AtSign size={12} strokeWidth={2} /> {t('chat.agent')}
          </button>
          <button className="composer-tag" type="button">
            <Slash size={12} strokeWidth={2} /> {t('chat.command')}
          </button>
          <button className="composer-tag" type="button">
            <Hash size={12} strokeWidth={2} /> {t('chat.project')}
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          rows={2}
          className="composer-input"
          disabled={isStreaming}
        />

        <div className="composer-toolbar no-drag">
          <div className="toolbar-group">
            <select
              value={config.model}
              onChange={(e) => setConfig({ model: e.target.value })}
              className="toolbar-select"
              title={t('input.model')}
            >
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="toolbar-group">
            <select
              value={String(config.temperature)}
              onChange={(e) => setConfig({ temperature: parseFloat(e.target.value) })}
              className="toolbar-select"
              title={t('input.temperature')}
            >
              {TEMPERATURES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div className="toolbar-group">
            <select
              value={config.reasoningEffort || 'medium'}
              onChange={(e) => setConfig({ reasoningEffort: e.target.value as AppConfig['reasoningEffort'] })}
              className="toolbar-select"
              title={t('input.reasoningEffort')}
            >
              {REASONING_EFFORTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="toolbar-group">
            <select
              value={config.permissionMode}
              onChange={(e) => setConfig({ permissionMode: e.target.value as AppConfig['permissionMode'] })}
              className="toolbar-select"
              title={t('input.permissionMode')}
            >
              {PERMISSION_MODES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="composer-footer">
          <span className="composer-hint">
            <kbd>Enter</kbd> {t('chat.enterToSend')} · <kbd>Shift+Enter</kbd> {t('chat.shiftEnterToNewline')}
          </span>
          <button
            onClick={isStreaming ? handleStop : handleSubmit}
            title={isStreaming ? t('chat.stop') : t('chat.send')}
            aria-label={isStreaming ? t('chat.stop') : t('chat.send')}
            disabled={!isStreaming && !input.trim()}
            className="send-button"
          >
            {isStreaming ? <Square size={13} strokeWidth={1.9} /> : <ArrowRight size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}
