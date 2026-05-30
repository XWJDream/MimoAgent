"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskListTool = exports.TaskUpdateTool = exports.TaskCreateTool = void 0;
const base_js_1 = require("../base.js");
// Global task store (shared across tool instances)
const tasks = [];
let nextId = 1;
class TaskCreateTool extends base_js_1.BaseTool {
    name = 'task_create';
    description = 'Create a new task to track progress on a multi-step operation.';
    riskLevel = 'write';
    categories = ['task'];
    parameters = {
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
    async execute(args, _context) {
        const { subject, description } = args;
        const task = {
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
exports.TaskCreateTool = TaskCreateTool;
class TaskUpdateTool extends base_js_1.BaseTool {
    name = 'task_update';
    description = 'Update a task\'s status or description.';
    riskLevel = 'write';
    categories = ['task'];
    parameters = {
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
    async execute(args, _context) {
        const { task_id, status, description } = args;
        const task = tasks.find((t) => t.id === task_id);
        if (!task) {
            return { output: `Task not found: ${task_id}`, isError: true };
        }
        if (status)
            task.status = status;
        if (description)
            task.description = description;
        return {
            output: `Task updated: [${task.id}] ${task.subject} (${task.status})`,
            isError: false,
        };
    }
}
exports.TaskUpdateTool = TaskUpdateTool;
class TaskListTool extends base_js_1.BaseTool {
    name = 'task_list';
    description = 'List all tasks and their status.';
    riskLevel = 'read';
    categories = ['task'];
    parameters = {
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
    async execute(_args, _context) {
        if (tasks.length === 0) {
            return { output: 'No tasks.', isError: false };
        }
        const statusIcon = {
            pending: '[ ]',
            in_progress: '[~]',
            completed: '[x]',
        };
        const lines = tasks.map((t) => `${statusIcon[t.status]} ${t.id}: ${t.subject} - ${t.description}`);
        return { output: lines.join('\n'), isError: false };
    }
}
exports.TaskListTool = TaskListTool;
//# sourceMappingURL=task.js.map