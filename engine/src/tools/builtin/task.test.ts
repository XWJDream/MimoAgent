import { describe, expect, it } from 'vitest';
import { InMemoryTaskStore, TaskCreateTool, TaskListTool, TaskUpdateTool } from './task.js';

const context = { workingDirectory: process.cwd(), fileCache: {} as never };

describe('task tools', () => {
  it('create, update, and list tasks from an injected store', async () => {
    const store = new InMemoryTaskStore();
    const create = new TaskCreateTool(store);
    const update = new TaskUpdateTool(store);
    const list = new TaskListTool(store);

    await create.execute({ subject: 'Plan', description: 'Write plan' }, context);
    await update.execute({ task_id: '1', status: 'completed', description: 'Done' }, context);
    const result = await list.execute({}, context);

    expect(result.output).toContain('[x] 1: Plan - Done');
  });

  it('does not leak state between stores', async () => {
    const firstStore = new InMemoryTaskStore();
    const secondStore = new InMemoryTaskStore();

    await new TaskCreateTool(firstStore).execute({ subject: 'Only first', description: 'A' }, context);
    const secondList = await new TaskListTool(secondStore).execute({}, context);

    expect(secondList.output).toBe('No tasks.');
  });
});
