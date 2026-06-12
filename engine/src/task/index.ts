/**
 * 任务系统模块导出
 */
export type { Task, TaskEvent, TaskStatus } from './schema.js';
export { isValidTransition, statusToEventType, VALID_TRANSITIONS } from './schema.js';
export { TaskRegistry } from './registry.js';
export { decideGate, MAX_GATE_REACT } from './gate.js';
export type { GateDecision } from './gate.js';
