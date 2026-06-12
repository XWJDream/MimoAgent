/**
 * 统一任务工具 — 替代原来的 task_create / task_update / task_list
 * 支持 create, list, get, start, block, unblock, done, abandon, rename 操作
 */
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
import type { TaskRegistry } from '../../task/registry.js';
import type { TaskStatus } from '../../task/schema.js';

export class TaskTool extends BaseTool {
  readonly name = 'task';
  readonly description = '管理任务。操作: create, list, get, start, block, unblock, done, abandon, rename';
  readonly riskLevel = 'write' as const;
  readonly categories = ['task' as const];

  private registry: TaskRegistry;
  private sessionId: string;

  constructor(registry: TaskRegistry, sessionId: string) {
    super();
    this.registry = registry;
    this.sessionId = sessionId;
  }

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'task',
      description: '管理任务。操作: create, list, get, start, block, unblock, done, abandon, rename',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['create', 'list', 'get', 'start', 'block', 'unblock', 'done', 'abandon', 'rename'],
            description: '操作类型',
          },
          task_id: {
            type: 'string',
            description: '任务 ID (T1, T1.1 等)，get/start/block/unblock/done/abandon/rename 时必填',
          },
          summary: {
            type: 'string',
            description: '任务描述，create/rename 时必填',
          },
          parent_id: {
            type: 'string',
            description: '父任务 ID，create 时可选（用于创建子任务）',
          },
          status_filter: {
            type: 'string',
            enum: ['open', 'in_progress', 'blocked', 'done', 'abandoned'],
            description: '状态过滤，list 时可选',
          },
        },
        required: ['operation'],
      },
    },
  };

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const { operation, task_id, summary, parent_id, status_filter } = args as {
      operation: string;
      task_id?: string;
      summary?: string;
      parent_id?: string;
      status_filter?: string;
    };

    try {
      switch (operation) {
        case 'create': {
          if (!summary) return { output: '缺少 summary 参数', isError: true };
          const task = this.registry.create(this.sessionId, summary, parent_id);
          return { output: `任务已创建: [${task.id}] ${task.summary}`, isError: false };
        }

        case 'list': {
          const filter = status_filter ? { status: status_filter as TaskStatus } : undefined;
          const tasks = this.registry.list(this.sessionId, filter);
          if (tasks.length === 0) return { output: '暂无任务。', isError: false };

          const statusIcon: Record<string, string> = {
            open: '[ ]',
            in_progress: '[~]',
            blocked: '[!]',
            done: '[x]',
            abandoned: '[-]',
          };

          const lines = tasks.map(t => {
            const parentInfo = t.parentId ? ` (${t.parentId}的子任务)` : '';
            return `${statusIcon[t.status]} ${t.id}: ${t.summary}${parentInfo}`;
          });
          return { output: lines.join('\n'), isError: false };
        }

        case 'get': {
          if (!task_id) return { output: '缺少 task_id 参数', isError: true };
          const task = this.registry.get(this.sessionId, task_id);
          if (!task) return { output: `任务不存在: ${task_id}`, isError: true };
          return {
            output: [
              `ID: ${task.id}`,
              `状态: ${task.status}`,
              `描述: ${task.summary}`,
              task.parentId ? `父任务: ${task.parentId}` : null,
              task.owner ? `归属: ${task.owner}` : null,
              `创建: ${new Date(task.createdAt).toLocaleString()}`,
              `更新: ${new Date(task.updatedAt).toLocaleString()}`,
              task.endedAt ? `结束: ${new Date(task.endedAt).toLocaleString()}` : null,
            ].filter(Boolean).join('\n'),
            isError: false,
          };
        }

        case 'start': {
          if (!task_id) return { output: '缺少 task_id 参数', isError: true };
          const task = this.registry.start(this.sessionId, task_id);
          return { output: `任务已开始: [${task.id}] ${task.summary}`, isError: false };
        }

        case 'block': {
          if (!task_id) return { output: '缺少 task_id 参数', isError: true };
          const task = this.registry.block(this.sessionId, task_id);
          return { output: `任务已阻塞: [${task.id}] ${task.summary}`, isError: false };
        }

        case 'unblock': {
          if (!task_id) return { output: '缺少 task_id 参数', isError: true };
          const task = this.registry.unblock(this.sessionId, task_id);
          return { output: `任务已解除阻塞: [${task.id}] ${task.summary}`, isError: false };
        }

        case 'done': {
          if (!task_id) return { output: '缺少 task_id 参数', isError: true };
          const task = this.registry.done(this.sessionId, task_id);
          return { output: `任务已完成: [${task.id}] ${task.summary}`, isError: false };
        }

        case 'abandon': {
          if (!task_id) return { output: '缺少 task_id 参数', isError: true };
          const task = this.registry.abandon(this.sessionId, task_id);
          return { output: `任务已放弃: [${task.id}] ${task.summary}`, isError: false };
        }

        case 'rename': {
          if (!task_id || !summary) return { output: '缺少 task_id 或 summary 参数', isError: true };
          const task = this.registry.rename(this.sessionId, task_id, summary);
          return { output: `任务已重命名: [${task.id}] ${task.summary}`, isError: false };
        }

        default:
          return { output: `未知操作: ${operation}`, isError: true };
      }
    } catch (err) {
      return {
        output: `任务操作失败: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }
}

// 保留旧的 InMemoryTaskStore 和旧工具类以兼容现有测试
// 但在实际注册时使用新的 TaskTool

export interface Task {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
}

export interface TaskStore {
  create(subject: string, description: string): Task;
  update(taskId: string, updates: { status?: Task['status']; description?: string }): Task | null;
  list(): Task[];
}

export class InMemoryTaskStore implements TaskStore {
  private tasks: Task[] = [];
  private nextId = 1;

  create(subject: string, description: string): Task {
    const task: Task = {
      id: String(this.nextId++),
      subject,
      description,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.tasks.push(task);
    return task;
  }

  update(taskId: string, updates: { status?: Task['status']; description?: string }): Task | null {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    if (updates.status) task.status = updates.status;
    if (updates.description) task.description = updates.description;
    return task;
  }

  list(): Task[] {
    return [...this.tasks];
  }
}

export class TaskCreateTool extends BaseTool {
  constructor(private readonly store: TaskStore = new InMemoryTaskStore()) {
    super();
  }

  readonly name = 'task_create';
  readonly description = 'Create a new task to track progress on a multi-step operation.';
  readonly riskLevel = 'write' as const;
  readonly categories = ['task' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'task_create',
      description: 'Create a new task.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Brief title for the task' },
          description: { type: 'string', description: 'Detailed description of what needs to be done' },
        },
        required: ['subject', 'description'],
      },
    },
  };

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const { subject, description } = args as { subject: string; description: string };
    const task = this.store.create(subject, description);
    return {
      output: `Task created: [${task.id}] ${task.subject}`,
      isError: false,
    };
  }
}

export class TaskUpdateTool extends BaseTool {
  constructor(private readonly store: TaskStore = new InMemoryTaskStore()) {
    super();
  }

  readonly name = 'task_update';
  readonly description = 'Update a task\'s status or description.';
  readonly riskLevel = 'write' as const;
  readonly categories = ['task' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'task_update',
      description: 'Update a task.',
      parameters: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'The task ID to update' },
          status: { type: 'string', description: 'New status', enum: ['pending', 'in_progress', 'completed'] },
          description: { type: 'string', description: 'New description' },
        },
        required: ['task_id'],
      },
    },
  };

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const { task_id, status, description } = args as {
      task_id: string;
      status?: string;
      description?: string;
    };

    const task = this.store.update(task_id, {
      status: status as Task['status'] | undefined,
      description,
    });
    if (!task) {
      return { output: `Task not found: ${task_id}`, isError: true };
    }

    return {
      output: `Task updated: [${task.id}] ${task.subject} (${task.status})`,
      isError: false,
    };
  }
}

export class TaskListTool extends BaseTool {
  constructor(private readonly store: TaskStore = new InMemoryTaskStore()) {
    super();
  }

  readonly name = 'task_list';
  readonly description = 'List all tasks and their status.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['task' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'task_list',
      description: 'List all tasks.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  };

  async execute(_args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const tasks = this.store.list();
    if (tasks.length === 0) {
      return { output: 'No tasks.', isError: false };
    }

    const statusIcon: Record<string, string> = {
      pending: '[ ]',
      in_progress: '[~]',
      completed: '[x]',
    };

    const lines = tasks.map(
      (t) => `${statusIcon[t.status]} ${t.id}: ${t.subject} - ${t.description}`,
    );

    return { output: lines.join('\n'), isError: false };
  }
}
