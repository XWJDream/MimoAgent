import React, { useState } from "react";
import { useConfigStore } from "../../stores/configStore";
import { ModelSelector } from "./ModelSelector";
import { PermissionMode } from "./PermissionMode";
import { Moon, Sun } from "lucide-react";
import { useT } from "../../i18n";
import { useToast } from "../common/Toast";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { config, setConfig, validateApi } = useConfigStore();
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState(config.apiBase);
  const t = useT();
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSave = () => {
    setConfig({
      apiBase,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    });
    setApiKey("");
    toast('设置已保存', 'success');
    onClose();
    setTimeout(() => validateApi(), 300);
  };

  const handleClearApiKey = () => {
    if (!confirm('确定要清除 API Key 吗？')) return;
    setConfig({ apiKey: "" });
    setApiKey("");
    toast('API Key 已清除', 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background:
          "linear-gradient(145deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 95%, var(--bg-base)) 100%)",
        animation: "settingsFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        padding: "20px",
      }}
    >
      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes settingsSlideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .settings-input:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 99, 102, 241), 0.15),
                      0 0 20px rgba(var(--accent-rgb, 99, 102, 241), 0.1);
        }
        .settings-input::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }
        .settings-btn-ghost:hover {
          background: var(--bg-hover) !important;
          color: var(--text-primary) !important;
        }
        .settings-btn-primary {
          position: relative;
          overflow: hidden;
        }
        .settings-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .settings-btn-primary:hover::before {
          opacity: 1;
        }
        .settings-section {
          position: relative;
        }
        .settings-section::before {
          content: '';
          position: absolute;
          left: -16px;
          top: 8px;
          bottom: 8px;
          width: 3px;
          background: linear-gradient(180deg, var(--accent), transparent);
          border-radius: 2px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .settings-section:hover::before {
          opacity: 1;
        }
        .settings-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .settings-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .settings-scroll::-webkit-scrollbar-thumb {
          background: var(--border-subtle);
          border-radius: 3px;
        }
        .settings-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-center px-8 py-6 shrink-0">
        <div
          className="flex items-center gap-4"
          style={{
            padding: "70px",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, white))",
              boxShadow:
                "0 4px 12px rgba(var(--accent-rgb, 99, 102, 241), 0.3)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className="text-center">
            <h2
              className="text-xl font-semibold tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              {t('settings.title')}
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-muted)", opacity: 0.7 }}
            >
              {t('settings.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto settings-scroll flex justify-center">
        <div className="w-full max-w-3xl px-12 py-10 space-y-10">
          {/* Model */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.model')}
            </label>
            <ModelSelector />
          </div>

          {/* API Base */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.apiBase')}
            </label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="settings-input w-full rounded-xl px-5 py-4 text-sm focus:outline-none transition-all duration-300"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              placeholder="https://api.xiaomimimo.com/v1"
            />
          </div>

          {/* API Key */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.apiKey')}
            </label>
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-medium"
                style={{
                  color: config.apiKeyConfigured
                    ? "var(--success)"
                    : "var(--warning)",
                }}
              >
                {config.apiKeyConfigured
                  ? t('settings.configured', { preview: config.apiKeyPreview ?? '' })
                  : t('settings.notConfigured')}
              </span>
              {config.apiKeyConfigured && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="text-xs rounded-lg px-3 py-1.5 transition-all duration-200 font-medium"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--error)";
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {t('settings.clearKey')}
                </button>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="settings-input w-full rounded-xl px-5 py-4 text-sm focus:outline-none transition-all duration-300"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
              placeholder={
                config.apiKeyConfigured
                  ? t('settings.keepCurrentKey')
                  : t('settings.enterApiKey')
              }
            />
          </div>

          {/* Permission Mode */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.permissionMode')}
            </label>
            <PermissionMode />
          </div>

          {/* Tool Mode */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.toolPreset')}
            </label>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ["plan", t('toolPreset.plan'), t('settings.toolPreset.planDesc')],
                  ["act", t('toolPreset.act'), t('settings.toolPreset.actDesc')],
                ] as const
              ).map(([value, label, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setConfig({ toolPreset: value })}
                  className="flex flex-col items-start gap-2 px-5 py-5 rounded-xl text-sm transition-all duration-300 group"
                  style={{
                    background:
                      config.toolPreset === value
                        ? "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, white))"
                        : "var(--bg-base)",
                    color:
                      config.toolPreset === value
                        ? "#fff"
                        : "var(--text-secondary)",
                    border: `1px solid ${config.toolPreset === value ? "var(--accent)" : "var(--border-subtle)"}`,
                    boxShadow:
                      config.toolPreset === value
                        ? "0 8px 24px rgba(var(--accent-rgb, 99, 102, 241), 0.3)"
                        : "none",
                  }}
                >
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs opacity-70 leading-relaxed">
                    {desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.temperature')}{" "}
              <span
                className="font-normal normal-case tracking-normal opacity-100"
                style={{ color: "var(--text-muted)" }}
              >
                ({config.temperature})
              </span>
            </label>
            <div className="px-2 py-2">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) =>
                  setConfig({ temperature: parseFloat(e.target.value) })
                }
                className="w-full h-2.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(config.temperature / 2) * 100}%, var(--border-subtle) ${(config.temperature / 2) * 100}%, var(--border-subtle) 100%)`,
                  accentColor: "var(--accent)",
                }}
              />
            </div>
          </div>

          {/* Max Turns */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.maxTurns')}
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={config.maxTurns}
              onChange={(e) =>
                setConfig({ maxTurns: parseInt(e.target.value) })
              }
              className="settings-input w-full rounded-xl px-5 py-4 text-sm focus:outline-none transition-all duration-300"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Sandbox */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.sandboxMode')}
            </label>
            <button
              type="button"
              onClick={() =>
                setConfig({ sandboxEnabled: !config.sandboxEnabled })
              }
              className="w-full flex items-center justify-between px-5 py-5 rounded-xl text-sm transition-all duration-300"
              style={{
                background: config.sandboxEnabled
                  ? "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--bg-base)), var(--bg-base))"
                  : "var(--bg-base)",
                border: `1px solid ${config.sandboxEnabled ? "var(--accent)" : "var(--border-subtle)"}`,
                color: config.sandboxEnabled
                  ? "var(--accent)"
                  : "var(--text-secondary)",
                boxShadow: config.sandboxEnabled
                  ? "0 4px 16px rgba(var(--accent-rgb, 99, 102, 241), 0.15)"
                  : "none",
              }}
            >
              <span className="font-semibold">
                {config.sandboxEnabled ? t('settings.enabled') : t('settings.disabled')}
              </span>
              <span className="text-xs opacity-70">
                {t('settings.sandboxDesc')}
              </span>
            </button>
          </div>

          {/* Theme */}
          <div className="settings-section space-y-3">
            <label
              className="block text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              {t('settings.theme')}
            </label>
            <div className="grid grid-cols-2 gap-4">
              {(["dark", "light"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setConfig({ theme })}
                  className="flex items-center justify-center gap-3 px-5 py-5 rounded-xl text-sm transition-all duration-300"
                  style={{
                    background:
                      config.theme === theme
                        ? "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, white))"
                        : "var(--bg-base)",
                    color:
                      config.theme === theme ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${config.theme === theme ? "var(--accent)" : "var(--border-subtle)"}`,
                    boxShadow:
                      config.theme === theme
                        ? "0 8px 24px rgba(var(--accent-rgb, 99, 102, 241), 0.3)"
                        : "none",
                  }}
                >
                  {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                  <span className="font-semibold">
                    {theme === "dark" ? t('settings.dark') : t('settings.light')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex justify-center">
        <div className="w-full max-w-3xl px-12 py-5 flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: "10px 24px" }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            style={{ padding: "10px 28px" }}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
