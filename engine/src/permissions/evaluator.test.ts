import { describe, it, expect } from 'vitest';
import {
  evaluate,
  evaluateResult,
  merge,
  fromConfig,
  toConfig,
  type Rule,
  type Ruleset,
} from './evaluator.js';

describe('evaluate', () => {
  it('should return default ask rule when no rulesets provided', () => {
    const result = evaluate('read', 'file.txt');
    expect(result.action).toBe('ask');
    expect(result.permission).toBe('read');
    expect(result.pattern).toBe('*');
  });

  it('should match a single rule', () => {
    const rules: Ruleset = [
      { permission: 'read', pattern: '*', action: 'allow' },
    ];
    const result = evaluate('read', 'file.txt', rules);
    expect(result.action).toBe('allow');
  });

  it('should use last-match-wins strategy', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '*', action: 'allow' },
      { permission: 'read', pattern: '*.env', action: 'deny' },
    ];
    const result = evaluate('read', '.env', rules);
    expect(result.action).toBe('deny');
  });

  it('should match wildcard permission', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '*', action: 'allow' },
    ];
    expect(evaluate('read', 'file.txt', rules).action).toBe('allow');
    expect(evaluate('write', 'file.txt', rules).action).toBe('allow');
    expect(evaluate('shell', 'file.txt', rules).action).toBe('allow');
  });

  it('should match wildcard pattern', () => {
    const rules: Ruleset = [
      { permission: 'read', pattern: '**', action: 'allow' },
    ];
    expect(evaluate('read', 'file.txt', rules).action).toBe('allow');
    expect(evaluate('read', 'src/index.ts', rules).action).toBe('allow');
  });

  it('should merge multiple rulesets', () => {
    const defaults: Ruleset = [
      { permission: '*', pattern: '*', action: 'allow' },
    ];
    const overrides: Ruleset = [
      { permission: 'write', pattern: '*', action: 'deny' },
    ];
    const result = evaluate('write', 'file.txt', defaults, overrides);
    expect(result.action).toBe('deny');
  });

  it('should match with path patterns', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '*', action: 'allow' },
      { permission: '*', pattern: '*.env', action: 'ask' },
    ];
    expect(evaluate('read', 'file.txt', rules).action).toBe('allow');
    expect(evaluate('read', '.env', rules).action).toBe('ask');
  });

  it('should handle no match gracefully', () => {
    const rules: Ruleset = [
      { permission: 'write', pattern: '*.txt', action: 'deny' },
    ];
    const result = evaluate('read', 'file.ts', rules);
    expect(result.action).toBe('ask');
  });

  it('should match complex patterns', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '**/.git/**', action: 'deny' },
    ];
    expect(evaluate('write', '.git/config', rules).action).toBe('deny');
    expect(evaluate('write', 'project/.git/objects/abc', rules).action).toBe('deny');
    expect(evaluate('write', 'file.txt', rules).action).toBe('ask');
  });
});

describe('evaluateResult', () => {
  it('should return allowed: true for allow action', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '*', action: 'allow' },
    ];
    const result = evaluateResult('read', 'file.txt', rules);
    expect(result.allowed).toBe(true);
    expect(result.needsConfirmation).toBe(false);
    expect(result.matchedRule).toBeDefined();
  });

  it('should return allowed: false for deny action', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '*', action: 'deny' },
    ];
    const result = evaluateResult('read', 'file.txt', rules);
    expect(result.allowed).toBe(false);
    expect(result.needsConfirmation).toBe(false);
  });

  it('should return needsConfirmation: true for ask action', () => {
    const rules: Ruleset = [
      { permission: '*', pattern: '*', action: 'ask' },
    ];
    const result = evaluateResult('read', 'file.txt', rules);
    expect(result.allowed).toBe(false);
    expect(result.needsConfirmation).toBe(true);
  });

  it('should return default ask rule when no match (rulesets empty)', () => {
    const result = evaluateResult('read', 'file.txt');
    expect(result.matchedRule).toBeDefined();
    expect(result.matchedRule?.action).toBe('ask');
  });
});

describe('merge', () => {
  it('should flatten multiple rulesets', () => {
    const a: Ruleset = [{ permission: 'read', pattern: '*', action: 'allow' }];
    const b: Ruleset = [{ permission: 'write', pattern: '*', action: 'deny' }];
    const merged = merge(a, b);
    expect(merged).toHaveLength(2);
    expect(merged[0].permission).toBe('read');
    expect(merged[1].permission).toBe('write');
  });

  it('should handle empty rulesets', () => {
    const merged = merge([], []);
    expect(merged).toHaveLength(0);
  });

  it('should preserve order', () => {
    const a: Ruleset = [{ permission: 'a', pattern: '*', action: 'allow' }];
    const b: Ruleset = [{ permission: 'b', pattern: '*', action: 'deny' }];
    const c: Ruleset = [{ permission: 'c', pattern: '*', action: 'ask' }];
    const merged = merge(a, b, c);
    expect(merged.map((r) => r.permission)).toEqual(['a', 'b', 'c']);
  });
});

describe('fromConfig', () => {
  it('should convert shorthand config', () => {
    const config = { read: 'allow' as const, write: 'deny' as const };
    const rules = fromConfig(config);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({ permission: 'read', pattern: '*', action: 'allow' });
    expect(rules[1]).toEqual({ permission: 'write', pattern: '*', action: 'deny' });
  });

  it('should convert detailed config', () => {
    const config = {
      read: { '*': 'allow' as const, '*.env': 'ask' as const },
    };
    const rules = fromConfig(config);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual({ permission: 'read', pattern: '*', action: 'allow' });
    expect(rules[1]).toEqual({ permission: 'read', pattern: '*.env', action: 'ask' });
  });

  it('should handle mixed config', () => {
    const config = {
      read: { '*': 'allow' as const, '*.env': 'ask' as const },
      write: 'deny' as const,
    };
    const rules = fromConfig(config);
    expect(rules).toHaveLength(3);
  });

  it('should handle empty config', () => {
    const rules = fromConfig({});
    expect(rules).toHaveLength(0);
  });
});

describe('toConfig', () => {
  it('should convert rules to config object', () => {
    const rules: Ruleset = [
      { permission: 'read', pattern: '*', action: 'allow' },
      { permission: 'read', pattern: '*.env', action: 'ask' },
      { permission: 'write', pattern: '*', action: 'deny' },
    ];
    const config = toConfig(rules);
    expect(config).toEqual({
      read: { '*': 'allow', '*.env': 'ask' },
      write: { '*': 'deny' },
    });
  });

  it('should handle empty ruleset', () => {
    const config = toConfig([]);
    expect(config).toEqual({});
  });
});

describe('fromConfig + toConfig roundtrip', () => {
  it('should be idempotent for simple configs', () => {
    const config = {
      read: { '*': 'allow' as const, '*.env': 'ask' as const },
      write: 'deny' as const,
    };
    const rules = fromConfig(config);
    const backToConfig = toConfig(rules);
    // The roundtrip should preserve the structure
    expect(backToConfig.read).toEqual({ '*': 'allow', '*.env': 'ask' });
    expect(backToConfig.write).toEqual({ '*': 'deny' });
  });
});
