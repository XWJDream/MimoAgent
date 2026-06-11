import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp, Bot, Check, ChevronRight, FilePlus2, Image, ListChecks,
  Mic, Package, Paperclip, Plus, Square, Target, X,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useConfigStore } from '../../stores/configStore';
import { useT } from '../../i18n';
import type { AppConfig, ChatAttachment } from '../../../shared/types';

const MODELS = [
  { id: 'mimo-v2.5-pro', name: 'MiMo v2.5 Pro' },
  { id: 'mimo-v2.5', name: 'MiMo v2.5' },
  { id: 'mimo-v2.5-tts-voiceclone', name: 'MiMo v2.5 TTS VoiceClone' },
  { id: 'mimo-v2.5-tts-voicedesign', name: 'MiMo v2.5 TTS VoiceDesign' },
  { id: 'mimo-v2.5-tts', name: 'MiMo v2.5 TTS' },
];

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function attachmentContext(attachment: ChatAttachment): string {
  if (attachment.kind === 'text' && attachment.content) {
    const extension = attachment.name.split('.').pop() || 'text';
    return `Attached text file: ${attachment.name}\nPath: ${attachment.path || '(dragged file)'}\n\`\`\`${extension}\n${attachment.content}\n\`\`\``;
  }
  return `Attached ${attachment.kind}: ${attachment.name}\nLocal path: ${attachment.path}\nInspect this file with the available file tools when needed.`;
}

export function InputArea() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [goalTracking, setGoalTracking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const handleSubmitRef = useRef<() => void>(() => {});
  const isSendingRef = useRef(false);
  const {
    addMessage, isStreaming, setStreaming, appendToken, setThinking, failResponse,
    addToolCall, finishToolCall, finishResponse,
  } = useChatStore();
  const { config, setConfig } = useConfigStore();
  const t = useT();
  const speechWindow = window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor; SpeechRecognition?: SpeechRecognitionConstructor };
  const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  const speechSupported = Boolean(SpeechRecognition);

  const REASONING_EFFORTS = [
    { value: 'low', label: t('input.reasoning.low') },
    { value: 'medium', label: t('input.reasoning.medium') },
    { value: 'high', label: t('input.reasoning.high') },
  ];

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || isSendingRef.current) return;

    isSendingRef.current = true;
    const attachmentSummary = attachments.length > 0
      ? `\n\n${attachments.map((item) => `[${item.kind}: ${item.name}]`).join(' ')}`
      : '';
    addMessage({
      id: Date.now().toString(36),
      role: 'user',
      content: `${trimmed || '请检查附件'}${attachmentSummary}`,
      timestamp: Date.now(),
    });

    const promptParts = [
      trimmed || 'Inspect the attached files and report what you find.',
      ...attachments.map(attachmentContext),
      ...(goalTracking ? [
        'Goal tracking is enabled. Keep working toward the user goal until it is genuinely complete. Track progress, verify the result, and do not stop at a proposal when implementation is possible.',
      ] : []),
    ];
    const agentPrompt = promptParts.join('\n\n');
    setInput('');
    setAttachments([]);
    setThinking(true);
    setStreaming(true);

    window.api?.agent.run(agentPrompt).catch((err: Error) => {
      console.error('Agent error:', err);
      failResponse(err.message);
    }).finally(() => {
      isSendingRef.current = false;
    });
  }, [input, attachments, goalTracking, isStreaming, addMessage, setStreaming, setThinking, failResponse]);

  handleSubmitRef.current = handleSubmit;

  const handleStop = useCallback(() => {
    window.api?.agent?.stop();
    setThinking(false);
    setStreaming(false);
    isSendingRef.current = false;
  }, [setStreaming, setThinking]);

  const pickAttachments = useCallback(async () => {
    const selected = await window.api?.files?.pickAttachments?.();
    if (!selected) return;
    setAttachments((current) => [...current, ...selected].slice(0, 10));
    setMenuOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped: ChatAttachment[] = [];
    for (const file of Array.from(event.dataTransfer.files).slice(0, 10)) {
      const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension);
      const isText = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.py', '.rs', '.go', '.yaml', '.yml', '.toml', '.txt', '.sh', '.sql'].includes(extension);
      dropped.push({
        name: file.name,
        path: '',
        size: file.size,
        kind: isImage ? 'image' : isText ? 'text' : 'file',
        ...(isText && file.size <= 1024 * 1024 ? { content: await file.text() } : {}),
      });
    }
    setAttachments((current) => [...current, ...dropped].slice(0, 10));
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join('');
      setInput((current) => `${current}${current ? ' ' : ''}${transcript}`);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  useEffect(() => {
    const element = textareaRef.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
    }
  }, [input]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => {
    const setPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<string>).detail;
      if (typeof prompt === 'string') {
        setInput(prompt);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    };
    const submit = () => requestAnimationFrame(() => handleSubmitRef.current());
    window.addEventListener('mimo:set-input', setPrompt);
    window.addEventListener('mimo:submit-input', submit);
    return () => {
      window.removeEventListener('mimo:set-input', setPrompt);
      window.removeEventListener('mimo:submit-input', submit);
    };
  }, []);

  useEffect(() => {
    const api = window.api;
    if (!api?.agent) return;
    const unsubToken = api.agent.onToken((token: string) => { appendToken(token); setThinking(false); });
    const unsubDone = api.agent.onDone((usage) => finishResponse(usage));
    const unsubError = api.agent.onError((error: string) => failResponse(error));
    const unsubToolStart = api.agent.onToolStart((tool) => addToolCall(tool));
    const unsubToolResult = api.agent.onToolResult((result) => finishToolCall(result));
    const unsubThinking = api.agent.onThinking(() => { setStreaming(true); setThinking(true); });
    return () => {
      unsubToken(); unsubDone(); unsubError(); unsubToolStart(); unsubToolResult(); unsubThinking();
      recognitionRef.current?.stop();
      api.agent.stop?.();
    };
  }, [appendToken, finishResponse, setThinking, setStreaming, failResponse, addToolCall, finishToolCall]);

  return (
    <div
      className="composer-container"
      onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {isDragging && <div className="composer-drop-overlay">{t('chat.dragDrop')}</div>}
      <div className="composer codex-composer">
        {attachments.length > 0 && (
          <div className="composer-attachments">
            {attachments.map((attachment, index) => (
              <div className="attachment-chip" key={`${attachment.name}-${index}`}>
                {attachment.kind === 'image' ? <Image size={13} /> : <Paperclip size={13} />}
                <span>{attachment.name}</span>
                <button type="button" aria-label={`移除 ${attachment.name}`} onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={t('chat.placeholder')}
          rows={3}
          className="composer-input"
          disabled={isStreaming}
        />

        <div className="codex-composer-footer no-drag">
          <div className="composer-actions-left">
            <div className="composer-menu-anchor" ref={menuRef}>
              <button type="button" className={`composer-icon-action ${menuOpen ? 'active' : ''}`} aria-label="更多功能" onClick={() => setMenuOpen((open) => !open)}>
                <Plus size={20} />
              </button>
              {menuOpen && (
                <div className="composer-menu">
                  <button type="button" onClick={pickAttachments}><Paperclip size={17} /><span>添加照片和文件</span></button>
                  <button type="button" onClick={() => setCreateOpen((open) => !open)}><FilePlus2 size={17} /><span>创建</span><ChevronRight size={16} className="menu-chevron" /></button>
                  {createOpen && (
                    <div className="composer-submenu">
                      <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('mimo:new-chat')); setMenuOpen(false); }}><Bot size={16} />新建会话</button>
                      <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('mimo:open-view', { detail: 'automation' })); setMenuOpen(false); }}><ListChecks size={16} />创建自动化</button>
                    </div>
                  )}
                  <div className="composer-menu-separator" />
                  <button type="button" onClick={() => setConfig({ toolPreset: config.toolPreset === 'plan' ? 'act' : 'plan' })}>
                    <ListChecks size={17} /><span>计划模式</span><span className={`menu-switch ${config.toolPreset === 'plan' ? 'on' : ''}`} />
                  </button>
                  <button type="button" onClick={() => setGoalTracking((enabled) => !enabled)}>
                    <Target size={17} /><span>追求目标</span><span className={`menu-switch ${goalTracking ? 'on' : ''}`} />
                  </button>
                  <div className="composer-menu-separator" />
                  <button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('mimo:open-view', { detail: 'plugins' })); setMenuOpen(false); }}>
                    <Package size={17} /><span>插件</span><ChevronRight size={16} className="menu-chevron" />
                  </button>
                </div>
              )}
            </div>

            <select
              className="composer-inline-select permission-select"
              value={config.permissionMode}
              onChange={(event) => setConfig({ permissionMode: event.target.value as AppConfig['permissionMode'] })}
              aria-label={t('input.permissionMode')}
            >
              <option value="suggest">建议模式</option>
              <option value="auto-edit">自动编辑</option>
              <option value="full-auto">完全访问</option>
            </select>
          </div>

          <div className="composer-actions-right">
            <select className="composer-inline-select model-select" value={config.model} onChange={(event) => setConfig({ model: event.target.value })} aria-label={t('input.model')}>
              {MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
            </select>
            <select className="composer-inline-select reasoning-select" value={config.reasoningEffort || 'medium'} onChange={(event) => setConfig({ reasoningEffort: event.target.value as AppConfig['reasoningEffort'] })} aria-label={t('input.reasoningEffort')}>
              {REASONING_EFFORTS.map((effort) => <option key={effort.value} value={effort.value}>{effort.label}</option>)}
            </select>
            <button
              type="button"
              className={`composer-icon-action ${isListening ? 'active listening' : ''}`}
              onClick={toggleVoice}
              disabled={!speechSupported}
              title={speechSupported ? (isListening ? '停止语音输入' : '语音输入') : '当前环境不支持语音输入'}
              aria-label={speechSupported ? (isListening ? '停止语音输入' : '语音输入') : '语音输入不可用'}
            >
              <Mic size={17} />
            </button>
            <button
              type="button"
              onClick={isStreaming ? handleStop : handleSubmit}
              aria-label={isStreaming ? t('chat.stop') : t('chat.send')}
              disabled={!isStreaming && !input.trim() && attachments.length === 0}
              className="send-button codex-send-button"
            >
              {isStreaming ? <Square size={13} /> : <ArrowUp size={18} />}
            </button>
          </div>
        </div>
        {(config.toolPreset === 'plan' || goalTracking) && (
          <div className="composer-mode-indicators">
            {config.toolPreset === 'plan' && <span><Check size={11} />计划模式</span>}
            {goalTracking && <span><Target size={11} />追求目标</span>}
          </div>
        )}
      </div>
    </div>
  );
}
