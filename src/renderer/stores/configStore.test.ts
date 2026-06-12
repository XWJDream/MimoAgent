import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConfigStore } from './configStore';

// Mock window.api
const mockConfigSet = vi.fn().mockResolvedValue({});
const mockConfigGet = vi.fn().mockResolvedValue({});
const mockApiValidate = vi.fn().mockResolvedValue({ valid: true });

Object.defineProperty(window, 'api', {
  value: {
    config: {
      set: mockConfigSet,
      get: mockConfigGet,
    },
    api: {
      validate: mockApiValidate,
    },
  },
  writable: true,
});

describe('configStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useConfigStore.setState({
      config: {
        model: 'mimo-v2.5-pro',
        apiBase: 'https://api.xiaomimimo.com/v1',
        apiKeyConfigured: false,
        apiKeyPreview: null,
        permissionMode: 'suggest',
        toolPreset: 'act',
        maxTurns: 50,
        temperature: 0.2,
        theme: 'sakura',
        selectedAvatarId: 'default',
        sandboxEnabled: false,
        reasoningEffort: 'medium',
      },
      apiStatus: 'unknown',
      apiError: null,
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useConfigStore.getState();

      expect(state.config.model).toBe('mimo-v2.5-pro');
      expect(state.config.apiBase).toBe('https://api.xiaomimimo.com/v1');
      expect(state.config.apiKeyConfigured).toBe(false);
      expect(state.config.apiKeyPreview).toBeNull();
      expect(state.config.permissionMode).toBe('suggest');
      expect(state.config.toolPreset).toBe('act');
      expect(state.config.maxTurns).toBe(50);
      expect(state.config.temperature).toBe(0.2);
      expect(state.config.theme).toBe('sakura');
    });

    it('should have unknown API status', () => {
      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('unknown');
      expect(state.apiError).toBeNull();
    });
  });

  describe('setConfig()', () => {
    it('should update config values', async () => {
      await useConfigStore.getState().setConfig({ model: 'gpt-4o' });

      const state = useConfigStore.getState();
      expect(state.config.model).toBe('gpt-4o');
    });

    it('should update API key configured status', async () => {
      await useConfigStore.getState().setConfig({ apiKey: 'sk-test-key-12345' });

      const state = useConfigStore.getState();
      expect(state.config.apiKeyConfigured).toBe(true);
    });

    it('should generate preview for long API key', async () => {
      await useConfigStore.getState().setConfig({ apiKey: 'sk-test-1234567890' });

      const state = useConfigStore.getState();
      expect(state.config.apiKeyPreview).toBe('sk-t••••7890');
    });

    it('should generate masked preview for short API key', async () => {
      await useConfigStore.getState().setConfig({ apiKey: 'short' });

      const state = useConfigStore.getState();
      expect(state.config.apiKeyPreview).toBe('••••');
    });

    it('should set preview to null for empty API key', async () => {
      await useConfigStore.getState().setConfig({ apiKey: '' });

      const state = useConfigStore.getState();
      expect(state.config.apiKeyConfigured).toBe(false);
      expect(state.config.apiKeyPreview).toBeNull();
    });

    it('should reset API status when key changes', async () => {
      useConfigStore.setState({ apiStatus: 'valid' });

      await useConfigStore.getState().setConfig({ apiKey: 'new-key' });

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('unknown');
      expect(state.apiError).toBeNull();
    });

    it('should reset API status when base changes', async () => {
      useConfigStore.setState({ apiStatus: 'valid' });

      await useConfigStore.getState().setConfig({ apiBase: 'https://new-api.com' });

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('unknown');
      expect(state.apiError).toBeNull();
    });

    it('should call window.api.config.set for each entry', async () => {
      await useConfigStore.getState().setConfig({ model: 'gpt-4o', temperature: 0.5 });

      expect(mockConfigSet).toHaveBeenCalledTimes(2);
      expect(mockConfigSet).toHaveBeenCalledWith('model', 'gpt-4o');
      expect(mockConfigSet).toHaveBeenCalledWith('temperature', 0.5);
    });

    it('should handle config set errors gracefully', async () => {
      mockConfigSet.mockRejectedValueOnce(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await useConfigStore.getState().setConfig({ model: 'gpt-4o' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('loadConfig()', () => {
    it('should load config from remote', async () => {
      const remoteConfig = {
        model: 'gpt-4o',
        apiBase: 'https://api.openai.com',
        apiKeyConfigured: true,
        apiKeyPreview: 'sk-a••••xyz',
      };

      mockConfigGet.mockResolvedValueOnce(remoteConfig);

      await useConfigStore.getState().loadConfig();

      const state = useConfigStore.getState();
      expect(state.config.model).toBe('gpt-4o');
      expect(state.config.apiBase).toBe('https://api.openai.com');
    });

    it('should handle missing remote config', async () => {
      mockConfigGet.mockResolvedValueOnce(null);

      await useConfigStore.getState().loadConfig();

      // Config should remain unchanged
      const state = useConfigStore.getState();
      expect(state.config.model).toBe('mimo-v2.5-pro');
    });
  });

  describe('validateApi()', () => {
    it('should set invalid status when no API key', async () => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, apiKeyConfigured: false },
      });

      await useConfigStore.getState().validateApi();

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('invalid');
      expect(state.apiError).toBe('未配置 API Key');
    });

    it('should set checking status during validation', async () => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, apiKeyConfigured: true },
      });

      // Don't await - check intermediate state
      const validatePromise = useConfigStore.getState().validateApi();

      // Should be in checking state
      expect(useConfigStore.getState().apiStatus).toBe('checking');

      await validatePromise;
    });

    it('should set valid status on success', async () => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, apiKeyConfigured: true },
      });
      mockApiValidate.mockResolvedValueOnce({ valid: true });

      await useConfigStore.getState().validateApi();

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('valid');
      expect(state.apiError).toBeNull();
    });

    it('should set invalid status on failure', async () => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, apiKeyConfigured: true },
      });
      mockApiValidate.mockResolvedValueOnce({ valid: false, error: 'Invalid key' });

      await useConfigStore.getState().validateApi();

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('invalid');
      expect(state.apiError).toBe('Invalid key');
    });

    it('should handle validation errors', async () => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, apiKeyConfigured: true },
      });
      mockApiValidate.mockRejectedValueOnce(new Error('Network error'));

      await useConfigStore.getState().validateApi();

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('invalid');
      expect(state.apiError).toBe('Network error');
    });

    it('should use default error message when no error provided', async () => {
      useConfigStore.setState({
        config: { ...useConfigStore.getState().config, apiKeyConfigured: true },
      });
      mockApiValidate.mockResolvedValueOnce({ valid: false });

      await useConfigStore.getState().validateApi();

      const state = useConfigStore.getState();
      expect(state.apiStatus).toBe('invalid');
      expect(state.apiError).toBe('验证失败');
    });
  });
});
