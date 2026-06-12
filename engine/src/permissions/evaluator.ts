/**
 * 权限评估器
 * 基于通配符匹配的分层权限评估系统
 *
 * 设计原则:
 *   - 最后匹配优先（last-match-wins）
 *   - 支持多规则集合并
 *   - 支持从配置对象创建规则集
 */

import { wildcardMatch } from './wildcard.js';

/** 权限动作 */
export type Action = 'allow' | 'deny' | 'ask';

/** 单条权限规则 */
export interface Rule {
  /** 权限名: "read", "write", "shell", "*" 等，支持通配符 */
  permission: string;
  /** 路径模式: "*.env", "src/**", "*" 等，支持通配符 */
  pattern: string;
  /** 动作 */
  action: Action;
}

/** 规则集 */
export type Ruleset = Rule[];

/** 评估结果 */
export interface EvalResult {
  /** 是否允许 */
  allowed: boolean;
  /** 匹配的规则（如果没有匹配则为 undefined） */
  matchedRule?: Rule;
  /** 是否需要询问用户 */
  needsConfirmation: boolean;
}

/**
 * 权限评估 — 最后匹配优先
 *
 * 1. 将所有规则集扁平化为一个数组
 * 2. 从后向前查找第一个同时匹配 permission 和 pattern 的规则
 * 3. 如果没有匹配，默认返回 "ask"
 *
 * @param permission 待评估的权限名
 * @param pattern    待评估的路径/资源模式
 * @param rulesets   一个或多个规则集
 * @returns 匹配到的规则，或默认的 ask 规则
 */
export function evaluate(
  permission: string,
  pattern: string,
  ...rulesets: Ruleset[]
): Rule {
  const rules = rulesets.flat();
  // 从后向前查找（last-match-wins），兼容 ES2022
  let match: Rule | undefined;
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (
      wildcardMatch(permission, rule.permission) &&
      wildcardMatch(pattern, rule.pattern)
    ) {
      match = rule;
      break;
    }
  }
  return match ?? { action: 'ask', permission, pattern: '*' };
}

/**
 * 将评估结果转换为用户友好的格式
 */
export function evaluateResult(
  permission: string,
  pattern: string,
  ...rulesets: Ruleset[]
): EvalResult {
  const rule = evaluate(permission, pattern, ...rulesets);
  return {
    allowed: rule.action === 'allow',
    matchedRule: rule,
    needsConfirmation: rule.action === 'ask',
  };
}

/**
 * 合并多个规则集
 * 后面的规则集优先级更高（last-match-wins）
 */
export function merge(...rulesets: Ruleset[]): Ruleset {
  return rulesets.flat();
}

/**
 * 从配置对象创建规则集
 *
 * 支持两种格式:
 * 1. 简写: { "read": "allow" } → 整个权限允许
 * 2. 完整: { "read": { "*": "allow", "*.env": "ask" } } → 按路径细分
 *
 * @param config 配置对象
 * @returns 规则集
 *
 * @example
 * fromConfig({
 *   "read": { "*": "allow", "*.env": "ask" },
 *   "write": "deny",
 * })
 * // → [
 * //   { permission: "read", pattern: "*", action: "allow" },
 * //   { permission: "read", pattern: "*.env", action: "ask" },
 * //   { permission: "write", pattern: "*", action: "deny" },
 * // ]
 */
export function fromConfig(
  config: Record<string, Record<string, Action> | Action>,
): Ruleset {
  const rules: Ruleset = [];
  for (const [perm, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      // 简写形式: "read": "allow"
      rules.push({ permission: perm, pattern: '*', action: value });
    } else {
      // 完整形式: "read": { "*": "allow", "*.env": "ask" }
      for (const [pat, action] of Object.entries(value)) {
        rules.push({ permission: perm, pattern: pat, action });
      }
    }
  }
  return rules;
}

/**
 * 将规则集转换为配置对象（fromConfig 的逆操作）
 *
 * @param rules 规则集
 * @returns 配置对象
 */
export function toConfig(
  rules: Ruleset,
): Record<string, Record<string, Action>> {
  const config: Record<string, Record<string, Action>> = {};
  for (const rule of rules) {
    if (!config[rule.permission]) {
      config[rule.permission] = {};
    }
    config[rule.permission][rule.pattern] = rule.action;
  }
  return config;
}
