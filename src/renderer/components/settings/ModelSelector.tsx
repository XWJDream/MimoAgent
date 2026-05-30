import React from 'react';
import { useConfigStore } from '../../stores/configStore';

const MODELS = [
  { id: 'mimo-v2.5-pro', name: 'MiMo v2.5 Pro' },
  { id: 'mimo-v2.5', name: 'MiMo v2.5' },
  { id: 'mimo-v2.5-tts-voiceclone', name: 'MiMo v2.5 TTS VoiceClone' },
  { id: 'mimo-v2.5-tts-voicedesign', name: 'MiMo v2.5 TTS VoiceDesign' },
  { id: 'mimo-v2.5-tts', name: 'MiMo v2.5 TTS' },
];

export function ModelSelector() {
  const { config, setConfig } = useConfigStore();

  return (
    <select
      value={config.model}
      onChange={(e) => setConfig({ model: e.target.value })}
      className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none transition-colors duration-150"
      style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
    >
      {MODELS.map((model) => (
        <option key={model.id} value={model.id}>{model.name}</option>
      ))}
    </select>
  );
}
