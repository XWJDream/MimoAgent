import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

interface Task {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
}

// Global task store (shared across tool instances)
const tasks: Task[] = [];
let nextId = 1;

export class TaskCreateTool extends BaseTool {
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
    const task: Task = {
      id: String(nextId++),
      subject,
      description,
      status: 'pending',
      createdAt: Date.now(),
    };
    tasks.push(task);
    return {
      output: `Task created: [${task.id}] ${task.subject}`,
      isError: false,
    };
  }
}

export class TaskUpdateTool extends BaseTool {
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

    const task = tasks.find((t) => t.id === task_id);
    if (!task) {
      return { output: `Task not found: ${task_id}`, isError: true };
    }

    if (status) task.status = status as Task['status'];
    if (description) task.description = description;

    return {
      output: `Task updated: [${task.id}] ${task.subject} (${task.status})`,
      isError: false,
    };
  }
}

export class TaskListTool extends BaseTool {
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
