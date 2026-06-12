/**
 * Agent 权限定义
 * 为不同 Agent 模式预定义规则集
 */

import type { AgentMode } from '../config/types.js';
import type { Ruleset } from './evaluator.js';

export type { AgentMode };

/**
 * 默认权限规则
 * 所有模式共享的基础规则
 *
 * 注意: pattern 字段使用 glob 匹配文件路径
 *   *  = 匹配非斜杠字符（单层目录内的文件）
 *   ** = 匹配任意路径（跨目录）
 */
export const DEFAULT_RULES: Ruleset = [
  { permission: '*', pattern: '**', action: 'allow' },
  { permission: 'read', pattern: '**/.env', action: 'ask' },
  { permission: 'read', pattern: '**/.env.*', action: 'ask' },
  { permission: 'read', pattern: '**/.env.example', action: 'allow' },
];

/**
 * build 模式 — 完整权限
 * Agent 可以执行所有操作（读写文件、运行命令等）
 */
export const BUILD_RULES: Ruleset = [
  ...DEFAULT_RULES,
];

/**
 * plan 模式 — 只读
 * Agent 只能读取文件和搜索，不能修改任何内容
 */
export const PLAN_RULES: Ruleset = [
  ...DEFAULT_RULES,
  { permission: 'write', pattern: '**', action: 'deny' },
  { permission: 'edit', pattern: '**', action: 'deny' },
  { permission: 'shell', pattern: '**', action: 'deny' },
  { permission: 'git_commit', pattern: '**', action: 'deny' },
];

/**
 * explore 子智能体 — 只读搜索
 * 最小权限，仅允许读取和搜索操作
 */
export const EXPLORE_RULES: Ruleset = [
  { permission: '*', pattern: '**', action: 'deny' },
  { permission: 'read', pattern: '**', action: 'allow' },
  { permission: 'grep', pattern: '**', action: 'allow' },
  { permission: 'glob', pattern: '**', action: 'allow' },
  { permission: 'web_fetch', pattern: '**', action: 'allow' },
  { permission: 'git_status', pattern: '**', action: 'allow' },
];

/**
 * 获取指定模式的规则集
 *
 * @param mode Agent 模式
 * @returns 对应的规则集
 */
export function getAgentRules(mode: AgentMode): Ruleset {
  switch (mode) {
    case 'build':
      return BUILD_RULES;
    case 'plan':
      return PLAN_RULES;
    case 'explore':
      return EXPLORE_RULES;
  }
}
