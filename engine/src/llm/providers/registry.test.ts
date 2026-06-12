import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from './registry.js';
import type { LLMProvider, ModelInfo } from './types.js';

function createMockProvider(name: string, models: ModelInfo[] = []): LLMProvider {
  return {
    name,
    models,
    createClient: () => ({
      chat: async () => ({}),
      chatStream: async function* () {},
    }),
    validateAuth: async () => true,
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register() and get()', () => {
    it('should register and retrieve a provider', () => {
      const provider = createMockProvider('test-provider');
      registry.register(provider);

      const retrieved = registry.get('test-provider');
      expect(retrieved).toBe(provider);
    });

    it('should return undefined for non-existent provider', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should overwrite existing provider with same name', () => {
      const provider1 = createMockProvider('test', []);
      const provider2 = createMockProvider('test', [{ id: 'model-1', name: 'Model 1', contextWindow: 1000, maxOutputTokens: 100, supportsTools: true, supportsStreaming: true }]);
      registry.register(provider1);
      registry.register(provider2);

      const retrieved = registry.get('test');
      expect(retrieved).toBe(provider2);
      expect(retrieved?.models).toHaveLength(1);
    });
  });

  describe('list()', () => {
    it('should return empty array when no providers registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered providers', () => {
      const p1 = createMockProvider('p1');
      const p2 = createMockProvider('p2');
      registry.register(p1);
      registry.register(p2);

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list).toContain(p1);
      expect(list).toContain(p2);
    });
  });

  describe('listNames()', () => {
    it('should return all provider names', () => {
      registry.register(createMockProvider('alpha'));
      registry.register(createMockProvider('beta'));

      expect(registry.listNames()).toEqual(['alpha', 'beta']);
    });
  });

  describe('listAllModels()', () => {
    it('should return empty array when no providers', () => {
      expect(registry.listAllModels()).toEqual([]);
    });

    it('should return all models across providers', () => {
      const model1: ModelInfo = { id: 'm1', name: 'Model 1', contextWindow: 1000, maxOutputTokens: 100, supportsTools: true, supportsStreaming: true };
      const model2: ModelInfo = { id: 'm2', name: 'Model 2', contextWindow: 2000, maxOutputTokens: 200, supportsTools: false, supportsStreaming: true };
      const model3: ModelInfo = { id: 'm3', name: 'Model 3', contextWindow: 3000, maxOutputTokens: 300, supportsTools: true, supportsStreaming: false };

      registry.register(createMockProvider('p1', [model1, model2]));
      registry.register(createMockProvider('p2', [model3]));

      const allModels = registry.listAllModels();
      expect(allModels).toHaveLength(3);
      expect(allModels[0]).toEqual({ provider: 'p1', model: model1 });
      expect(allModels[1]).toEqual({ provider: 'p1', model: model2 });
      expect(allModels[2]).toEqual({ provider: 'p2', model: model3 });
    });
  });

  describe('findProviderForModel()', () => {
    it('should find provider for a given model', () => {
      const model: ModelInfo = { id: 'target-model', name: 'Target', contextWindow: 1000, maxOutputTokens: 100, supportsTools: true, supportsStreaming: true };
      const provider = createMockProvider('p1', [model]);
      registry.register(provider);

      const result = registry.findProviderForModel('target-model');
      expect(result).toBeDefined();
      expect(result?.provider).toBe(provider);
      expect(result?.model).toBe(model);
    });

    it('should return undefined when model not found', () => {
      registry.register(createMockProvider('p1', [{ id: 'other', name: 'Other', contextWindow: 1000, maxOutputTokens: 100, supportsTools: true, supportsStreaming: true }]));

      expect(registry.findProviderForModel('non-existent')).toBeUndefined();
    });

    it('should return first matching provider when multiple have same model', () => {
      const model: ModelInfo = { id: 'shared-model', name: 'Shared', contextWindow: 1000, maxOutputTokens: 100, supportsTools: true, supportsStreaming: true };
      const p1 = createMockProvider('p1', [model]);
      const p2 = createMockProvider('p2', [model]);
      registry.register(p1);
      registry.register(p2);

      const result = registry.findProviderForModel('shared-model');
      expect(result?.provider).toBe(p1);
    });
  });

  describe('unregister()', () => {
    it('should remove a registered provider', () => {
      registry.register(createMockProvider('test'));
      expect(registry.has('test')).toBe(true);

      const removed = registry.unregister('test');
      expect(removed).toBe(true);
      expect(registry.has('test')).toBe(false);
    });

    it('should return false when removing non-existent provider', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('has()', () => {
    it('should return true for registered provider', () => {
      registry.register(createMockProvider('test'));
      expect(registry.has('test')).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      expect(registry.has('test')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all providers', () => {
      registry.register(createMockProvider('p1'));
      registry.register(createMockProvider('p2'));
      registry.register(createMockProvider('p3'));

      registry.clear();

      expect(registry.list()).toHaveLength(0);
      expect(registry.has('p1')).toBe(false);
    });
  });
});
