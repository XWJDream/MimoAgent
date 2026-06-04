/**
 * i18n module - Lightweight internationalization using Zustand
 */
import { create } from 'zustand';
import zhRaw from './zh';
import enRaw from './en';

export type Locale = 'zh' | 'en';
export type Messages = Record<string, string>;
export type MessageKey = string;

const zh = zhRaw as Messages;
const en = enRaw as Messages;
const locales: Record<Locale, Messages> = { zh, en };

interface I18nState {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: 'zh',
  messages: zh,
  setLocale: (locale) => {
    set({ locale, messages: locales[locale] || zh });
    window.api?.config?.set('locale', locale);
  },
}));

/**
 * Standalone translation function for use outside React components (stores, utils).
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const msg = useI18nStore.getState().messages[key] ?? zh[key] ?? key;
  if (!params) return msg;
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
    msg,
  );
}

/**
 * React hook version for components.
 * Returns a translation function that re-renders on locale change.
 */
export function useT() {
  const messages = useI18nStore((s) => s.messages);
  return (key: MessageKey, params?: Record<string, string | number>): string => {
    const msg = messages[key] ?? zh[key] ?? key;
    if (!params) return msg;
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
      msg,
    );
  };
}
