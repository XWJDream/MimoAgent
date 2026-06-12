/**
 * 任务系统类型定义
 * 五状态任务状态机 + 层级任务 ID + Gate 机制
 */

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'abandoned';

export interface Task {
  id: string;              // T1, T1.1, T1.1.1
  sessionId: string;
  parentId?: string;       // 父任务 ID
  status: TaskStatus;
  summary: string;
  owner?: string;          // 归属的 agent ID
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
}

export interface TaskEvent {
  id: number;
  taskId: string;
  sessionId: string;
  type: 'created' | 'started' | 'blocked' | 'unblocked' | 'done' | 'abandoned' | 'renamed';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** 状态转换规则 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['in_progress', 'abandoned'],
  in_progress: ['blocked', 'done', 'abandoned'],
  blocked: ['in_progress', 'abandoned'],
  done: [],                // 终态
  abandoned: [],           // 终态
};

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 状态到事件类型的映射 */
export function statusToEventType(status: TaskStatus): TaskEvent['type'] {
  switch (status) {
    case 'in_progress': return 'started';
    case 'blocked': return 'blocked';
    case 'done': return 'done';
    case 'abandoned': return 'abandoned';
    default: return 'created';
  }
}
