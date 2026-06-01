import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Volume2, Play, Square, Loader2 } from 'lucide-react';

interface TtsPanelProps {
  onClose: () => void;
}

const TTS_MODELS = [
  { value: 'mimo-v2.5-tts', label: 'mimo-v2.5-tts' },
  { value: 'mimo-v2.5-tts-voiceclone', label: 'mimo-v2.5-tts-voiceclone' },
  { value: 'mimo-v2.5-tts-voicedesign', label: 'mimo-v2.5-tts-voicedesign' },
];

const VOICE_OPTIONS = [
  { value: 'mimo_default', label: '默认' },
  { value: '冰糖', label: '冰糖' },
  { value: '茉莉', label: '茉莉' },
  { value: '苏打', label: '苏打' },
  { value: '白桦', label: '白桦' },
  { value: 'Mia', label: 'Mia' },
  { value: 'Chloe', label: 'Chloe' },
  { value: 'Milo', label: 'Milo' },
  { value: 'Dean', label: 'Dean' },
];

type Status = 'idle' | 'generating' | 'playing' | 'done' | 'error';

export function TtsPanel({ onClose }: TtsPanelProps) {
  const [text, setText] = useState('');
  const [model, setModel] = useState(TTS_MODELS[0].value);
  const [voice, setVoice] = useState(VOICE_OPTIONS[0].value);
  const [speed, setSpeed] = useState(1.0);
  const [thinkingIntensity, setThinkingIntensity] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [duration, setDuration] = useState(0);
  const [audioId, setAudioId] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount: stop audio, close AudioContext, clear timer
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
        sourceRef.current = null;
      }
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      setErrorMsg('请输入要转换的文本');
      setStatus('error');
      return;
    }

    // Stop any currently playing audio
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }

    setStatus('generating');
    setErrorMsg('');
    setProgress(0);

    try {
      const result = await window.api.tts.generate({ text: text.trim(), model, voice, speed, thinkingIntensity: thinkingIntensity || undefined });
      if (!result.success || !result.audioUrl) {
        setErrorMsg(result.error || '语音生成失败');
        setStatus('error');
        return;
      }
      setAudioId(result.audioId || '');

      // Fetch audio data via custom protocol
      const resp = await fetch(result.audioUrl);
      if (!resp.ok) {
        setErrorMsg(`获取音频失败: ${resp.status}`);
        setStatus('error');
        return;
      }

      const arrayBuffer = await resp.arrayBuffer();

      // Decode and play using Web Audio API
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      setDuration(audioBuffer.duration);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;

      source.onended = () => {
        setStatus('done');
        setProgress(1);
        if (progressTimer.current) {
          clearInterval(progressTimer.current);
          progressTimer.current = null;
        }
      };

      source.start(0);
      startTimeRef.current = ctx.currentTime;
      setStatus('playing');

      // Update progress bar
      progressTimer.current = setInterval(() => {
        if (!audioCtxRef.current) return;
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
        const pct = Math.min(elapsed / audioBuffer.duration, 1);
        setProgress(pct);
        if (pct >= 1) {
          clearInterval(progressTimer.current!);
          progressTimer.current = null;
        }
      }, 100);

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '语音生成失败');
      setStatus('error');
    }
  }, [text, model, voice, speed, thinkingIntensity]);

  const handleStop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setStatus('done');
    setProgress(0);
  }, []);

  const handleReplay = useCallback(() => {
    if (!audioCtxRef.current || !sourceRef.current?.buffer) return;
    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = sourceRef.current.buffer;
    source.connect(ctx.destination);
    sourceRef.current = source;
    source.onended = () => {
      setStatus('done');
      setProgress(1);
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
    };
    source.start(0);
    startTimeRef.current = ctx.currentTime;
    setStatus('playing');
    setProgress(0);
    progressTimer.current = setInterval(() => {
      if (!audioCtxRef.current || !source.buffer) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      const pct = Math.min(elapsed / source.buffer.duration, 1);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(progressTimer.current!);
        progressTimer.current = null;
      }
    }, 100);
  }, []);

  const handleSave = useCallback(async () => {
    if (!audioId) return;
    try {
      const result = await window.api.tts.save(audioId);
      if (result.success) {
        setSavedPath(result.filePath);
      } else if (result.error !== '已取消') {
        setErrorMsg(result.error);
        setStatus('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    }
  }, [audioId]);

  const handleClose = useCallback(() => {
    handleStop();
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    window.dispatchEvent(new CustomEvent('mimo:close-tts'));
    onClose();
  }, [onClose, handleStop]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 4,
    display: 'block',
  };

  return (
    <div className="workspace-panel" style={{ maxWidth: 640 }}>
      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-subtitle">语音合成</div>
          <h1 className="panel-title flex items-center gap-2">
            <Volume2 size={20} style={{ color: 'var(--accent)' }} />
            TTS 语音合成
          </h1>
        </div>
        <button className="icon-button" onClick={handleClose} title="关闭"><X size={16} /></button>
      </div>

      {/* Status / Error */}
      {status === 'error' && errorMsg && (
        <div className="error-banner">
          <span>{errorMsg}</span>
          <button className="error-banner-dismiss" onClick={() => { setStatus('idle'); setErrorMsg(''); }}>&times;</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Text Input */}
        <div className="workspace-card">
          <label style={labelStyle}>文本内容</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }}
          />
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
            {text.length} 字符
          </div>
        </div>

        {/* Controls */}
        <div className="workspace-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>模型</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {TTS_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>音色</label>
              <select value={voice} onChange={(e) => setVoice(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {VOICE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>语速: {speed.toFixed(1)}x</label>
              <input type="range" min={0.25} max={4.0} step={0.05} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>0.25x</span><span>4.0x</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>思考强度</label>
              <select value={thinkingIntensity} onChange={(e) => setThinkingIntensity(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">关闭</option>
                <option value="低">低</option>
                <option value="中">中</option>
                <option value="高">高</option>
              </select>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={status === 'generating' || !text.trim()}
            style={{ flex: 1 }}
          >
            {status === 'generating' ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> 生成中...</>
            ) : (
              <><Volume2 size={16} /> 生成语音</>
            )}
          </button>
          {(status === 'playing' || status === 'done') && (
            <>
              {status === 'playing' && (
                <button className="btn-secondary" onClick={handleStop}>
                  <Square size={14} /> 停止
                </button>
              )}
              {status === 'done' && (
                <>
                  <button className="btn-secondary" onClick={handleReplay}>
                    <Play size={14} /> 重播
                  </button>
                  <button className="btn-secondary" onClick={handleSave}>
                    保存文件
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Playback Progress */}
        {(status === 'playing' || (status === 'done' && duration > 0)) && (
          <div className="workspace-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Volume2 size={14} style={{ color: status === 'playing' ? 'var(--accent)' : 'var(--success)' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {status === 'playing' ? '播放中...' : '播放完成'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {duration.toFixed(1)}s
              </span>
            </div>
            <div style={{ width: '100%', height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 100ms linear' }} />
            </div>
          </div>
        )}

        {/* Saved Path */}
        {savedPath && (
          <div className="success-banner">
            已保存到: {savedPath}
          </div>
        )}
      </div>
    </div>
  );
}
