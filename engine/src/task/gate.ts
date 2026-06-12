/**
 * 任务门机制 (Gate)
 * 在 Agent 结束前检查是否有未完成任务，决定是否继续执行
 */
import type { Task } from './schema.js';
import { TaskRegistry } from './registry.js';

export type GateMode = 'main' | 'subagent';

const MAX_GATE_REACT_MAIN = 3;
const MAX_GATE_REACT_SUBAGENT = 2;

export interface GateDecision {
  action: 'continue' | 'stop';
  reason?: string;
  incompleteTasks?: Task[];
}

/**
 * 决定是否继续执行 Agent 循环
 * @param registry 任务注册中心
 * @param sessionId 当前会话 ID
 * @param reactCount 当前已重入次数
 * @param mode 运行模式：main（主循环）或 subagent（子代理）
 */
export function decideGate(
  registry: TaskRegistry,
  sessionId: string,
  reactCount: number,
  mode: GateMode = 'main',
): GateDecision {
  const maxReact = mode === 'subagent' ? MAX_GATE_REACT_SUBAGENT : MAX_GATE_REACT_MAIN;

  const all = registry.list(sessionId);
  // blocked 任务是 agent 无法自行解决的依赖，不应触发重入
  const actionable = all.filter(
    t => t.status === 'open' || t.status === 'in_progress',
  );

  // 所有任务已完成，可以停止
  if (actionable.length === 0) {
    return { action: 'stop' };
  }

  // 达到最大重入次数，强制停止
  if (reactCount >= maxReact) {
    return {
      action: 'stop',
      reason: `达到最大重入次数 (${maxReact})，强制退出`,
      incompleteTasks: actionable,
    };
  }

  // 还有可执行任务，继续执行
  return {
    action: 'continue',
    reason: `还有 ${actionable.length} 个可执行任务: ${actionable.map(t => t.id).join(', ')}`,
    incompleteTasks: actionable,
  };
}

export { MAX_GATE_REACT_MAIN, MAX_GATE_REACT_SUBAGENT };
