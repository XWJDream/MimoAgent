/**
 * 任务注册中心 — SQLite 持久化
 * 使用 better-sqlite3 存储任务数据
 */
import type Database from 'better-sqlite3';
import type { Task, TaskEvent, TaskStatus } from './schema.js';
import { isValidTransition, statusToEventType } from './schema.js';

export class TaskRegistry {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        parent_id TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        summary TEXT NOT NULL,
        owner TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        ended_at INTEGER,
        PRIMARY KEY (id, session_id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      )
    `);

    // 索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(session_id, status);
      CREATE INDEX IF NOT EXISTS idx_task_events_session ON task_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(session_id, task_id);
    `);
  }

  /** 创建任务 */
  create(sessionId: string, summary: string, parentId?: string): Task {
    const id = this.nextChildId(sessionId, parentId);
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO tasks (id, session_id, parent_id, status, summary, created_at, updated_at)
      VALUES (?, ?, ?, 'open', ?, ?, ?)
    `).run(id, sessionId, parentId || null, summary, now, now);

    this.recordEvent(id, sessionId, 'created', { summary, parentId });

    return this.get(sessionId, id)!;
  }

  /** 获取单个任务 */
  get(sessionId: string, taskId: string): Task | null {
    const row = this.db.prepare(`
      SELECT id, session_id, parent_id, status, summary, owner, created_at, updated_at, ended_at
      FROM tasks WHERE id = ? AND session_id = ?
    `).get(taskId, sessionId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.rowToTask(row);
  }

  /** 列出任务（可选状态过滤） */
  list(sessionId: string, filter?: { status?: TaskStatus }): Task[] {
    let sql = `SELECT id, session_id, parent_id, status, summary, owner, created_at, updated_at, ended_at
      FROM tasks WHERE session_id = ?`;
    const params: unknown[] = [sessionId];

    if (filter?.status) {
      sql += ` AND status = ?`;
      params.push(filter.status);
    }

    sql += ` ORDER BY created_at ASC`;

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => this.rowToTask(r));
  }

  /** 更新任务字段 */
  update(sessionId: string, taskId: string, updates: Partial<Pick<Task, 'summary' | 'owner' | 'status'>>): Task {
    const task = this.get(sessionId, taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const now = Date.now();
    const parts: string[] = [];
    const values: unknown[] = [];

    if (updates.summary !== undefined) {
      parts.push('summary = ?');
      values.push(updates.summary);
    }
    if (updates.owner !== undefined) {
      parts.push('owner = ?');
      values.push(updates.owner);
    }
    if (updates.status !== undefined) {
      if (!isValidTransition(task.status, updates.status)) {
        throw new Error(`Invalid transition: ${task.status} -> ${updates.status}`);
      }
      parts.push('status = ?');
      values.push(updates.status);
      if (updates.status === 'done' || updates.status === 'abandoned') {
        parts.push('ended_at = ?');
        values.push(now);
      }
      // 特殊处理 blocked → open：事件类型为 'unblocked' 而非 'created'
      const eventType = task.status === 'blocked' && updates.status === 'open'
        ? 'unblocked' as const
        : statusToEventType(updates.status);
      this.recordEvent(taskId, sessionId, eventType);
    }

    if (parts.length === 0) return task;

    parts.push('updated_at = ?');
    values.push(now);
    values.push(taskId, sessionId);

    this.db.prepare(`UPDATE tasks SET ${parts.join(', ')} WHERE id = ? AND session_id = ?`)
      .run(...values);

    return this.get(sessionId, taskId)!;
  }

  /** 删除任务 */
  delete(sessionId: string, taskId: string): void {
    this.db.prepare(`DELETE FROM tasks WHERE id = ? AND session_id = ?`).run(taskId, sessionId);
    this.db.prepare(`DELETE FROM task_events WHERE task_id = ? AND session_id = ?`).run(taskId, sessionId);
  }

  // --- 状态转换便捷方法 ---

  /** open → in_progress */
  start(sessionId: string, taskId: string): Task {
    return this.update(sessionId, taskId, { status: 'in_progress' });
  }

  /** in_progress → blocked */
  block(sessionId: string, taskId: string): Task {
    return this.update(sessionId, taskId, { status: 'blocked' });
  }

  /** blocked → open */
  unblock(sessionId: string, taskId: string): Task {
    return this.update(sessionId, taskId, { status: 'open' });
  }

  /** in_progress → done */
  done(sessionId: string, taskId: string): Task {
    return this.update(sessionId, taskId, { status: 'done' });
  }

  /** any → abandoned */
  abandon(sessionId: string, taskId: string): Task {
    return this.update(sessionId, taskId, { status: 'abandoned' });
  }

  /** 重命名 */
  rename(sessionId: string, taskId: string, newSummary: string): Task {
    const task = this.get(sessionId, taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    this.recordEvent(taskId, sessionId, 'renamed', { oldSummary: task.summary, newSummary });
    return this.update(sessionId, taskId, { summary: newSummary });
  }

  // --- 层级 ID 生成 ---

  /** 生成子任务 ID */
  nextChildId(sessionId: string, parentId?: string): string {
    if (!parentId) {
      // 顶级任务: T1, T2, T3, ...
      const rows = this.db.prepare(`
        SELECT id FROM tasks WHERE session_id = ? AND parent_id IS NULL ORDER BY id
      `).all(sessionId) as Array<{ id: string }>;

      const used = new Set(rows.map(r => parseInt(r.id.replace('T', ''), 10)).filter(n => !isNaN(n)));
      let n = 1;
      while (used.has(n)) n++;
      return `T${n}`;
    }

    // 子任务: T1.1, T1.2, T1.1.1, ...
    const rows = this.db.prepare(`
      SELECT id FROM tasks WHERE session_id = ? AND parent_id = ? ORDER BY id
    `).all(sessionId, parentId) as Array<{ id: string }>;

    const prefix = `${parentId}.`;
    const used = new Set(
      rows.map(r => parseInt(r.id.replace(prefix, ''), 10)).filter(n => !isNaN(n))
    );
    let n = 1;
    while (used.has(n)) n++;
    return `${prefix}${n}`;
  }

  // --- 事件查询 ---

  /** 查询事件 */
  getEvents(sessionId: string, taskId?: string): TaskEvent[] {
    let sql = `SELECT id, task_id, session_id, type, timestamp, metadata FROM task_events WHERE session_id = ?`;
    const params: unknown[] = [sessionId];

    if (taskId) {
      sql += ` AND task_id = ?`;
      params.push(taskId);
    }

    sql += ` ORDER BY id ASC`;

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as number,
      taskId: r.task_id as string,
      sessionId: r.session_id as string,
      type: r.type as TaskEvent['type'],
      timestamp: r.timestamp as number,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    }));
  }

  // --- 内部方法 ---

  private recordEvent(taskId: string, sessionId: string, type: TaskEvent['type'], metadata?: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT INTO task_events (task_id, session_id, type, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, sessionId, type, Date.now(), metadata ? JSON.stringify(metadata) : null);
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      parentId: row.parent_id as string | undefined,
      status: row.status as TaskStatus,
      summary: row.summary as string,
      owner: row.owner as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      endedAt: row.ended_at as number | undefined,
    };
  }
}
