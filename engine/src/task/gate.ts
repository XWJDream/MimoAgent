/**
 * 任务门机制 (Gate)
 * 在 Agent 结束前检查是否有未完成任务，决定是否继续执行
 */
import type { Task } from './schema.js';
import { TaskRegistry } from './registry.js';

const MAX_GATE_REACT = 3;

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
 */
export function decideGate(
  registry: TaskRegistry,
  sessionId: string,
  reactCount: number,
): GateDecision {
  const all = registry.list(sessionId);
  const incomplete = all.filter(
    t => t.status === 'open' || t.status === 'in_progress' || t.status === 'blocked',
  );

  // 所有任务已完成，可以停止
  if (incomplete.length === 0) {
    return { action: 'stop' };
  }

  // 达到最大重入次数，强制停止
  if (reactCount >= MAX_GATE_REACT) {
    return {
      action: 'stop',
      reason: `达到最大重入次数 (${MAX_GATE_REACT})，强制退出`,
      incompleteTasks: incomplete,
    };
  }

  // 还有未完成任务，继续执行
  return {
    action: 'continue',
    reason: `还有 ${incomplete.length} 个未完成任务: ${incomplete.map(t => t.id).join(', ')}`,
    incompleteTasks: incomplete,
  };
}

export { MAX_GATE_REACT };
