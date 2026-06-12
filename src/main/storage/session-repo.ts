import { randomBytes } from 'crypto';
import type Database from 'better-sqlite3';
import { getDatabase } from './database.js';

/** 会话数据结构（映射 Session 类型） */
export interface SessionRow {
  id: string;
  title: string;
  workspace_path: string;
  workspace_name: string;
  parent_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  message_count: number;
}

export interface SessionListOptions {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

/** 列出会话 */
export function listSessions(options?: SessionListOptions): SessionRow[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM sessions';
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (options?.search) {
    conditions.push('title LIKE @search');
    params.search = `%${options.search}%`;
  }
  if (options?.status) {
    conditions.push('status = @status');
    params.status = options.status;
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY updated_at DESC';

  if (options?.limit) {
    sql += ' LIMIT @limit';
    params.limit = options.limit;
    if (options.offset) {
      sql += ' OFFSET @offset';
      params.offset = options.offset;
    }
  }

  return db.prepare(sql).all(params) as SessionRow[];
}

/** 获取单个会话 */
export function getSession(id: string): SessionRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
}

/** 创建会话 */
export function createSession(data: {
  id?: string;
  title: string;
  workspacePath?: string;
  workspaceName?: string;
  parentId?: string;
}): SessionRow {
  const db = getDatabase();
  const now = Date.now();
  const id = data.id || generateId();

  db.prepare(`
    INSERT INTO sessions (id, title, workspace_path, workspace_name, parent_id, status, created_at, updated_at, message_count)
    VALUES (@id, @title, @workspace_path, @workspace_name, @parent_id, 'active', @created_at, @updated_at, 0)
  `).run({
    id,
    title: data.title,
    workspace_path: data.workspacePath || '',
    workspace_name: data.workspaceName || '',
    parent_id: data.parentId || null,
    created_at: now,
    updated_at: now,
  });

  return getSession(id)!;
}

/** 更新会话 */
export function updateSession(id: string, data: {
  title?: string;
  workspacePath?: string;
  workspaceName?: string;
  status?: string;
  messageCount?: number;
}): SessionRow | undefined {
  const db = getDatabase();
  const existing = getSession(id);
  if (!existing) return undefined;

  const sets: string[] = ['updated_at = @updated_at'];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };

  if (data.title !== undefined) { sets.push('title = @title'); params.title = data.title; }
  if (data.workspacePath !== undefined) { sets.push('workspace_path = @workspace_path'); params.workspace_path = data.workspacePath; }
  if (data.workspaceName !== undefined) { sets.push('workspace_name = @workspace_name'); params.workspace_name = data.workspaceName; }
  if (data.status !== undefined) { sets.push('status = @status'); params.status = data.status; }
  if (data.messageCount !== undefined) { sets.push('message_count = @message_count'); params.message_count = data.messageCount; }

  db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getSession(id);
}

/** 删除会话（级联删除消息、工具调用、使用记录） */
export function deleteSession(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

/** 归档会话 */
export function archiveSession(id: string): SessionRow | undefined {
  return updateSession(id, { status: 'archived' });
}

/** 分叉会话：复制会话及其所有消息和工具调用 */
export function forkSession(id: string, title: string): SessionRow | undefined {
  const db = getDatabase();
  const original = getSession(id);
  if (!original) return undefined;

  const newId = generateId();
  const now = Date.now();

  // 使用事务确保原子性
  const forkTx = db.transaction(() => {
    // 创建新会话
    db.prepare(`
      INSERT INTO sessions (id, title, workspace_path, workspace_name, parent_id, status, created_at, updated_at, message_count)
      VALUES (@id, @title, @workspace_path, @workspace_name, @parent_id, 'active', @created_at, @updated_at, @message_count)
    `).run({
      id: newId,
      title,
      workspace_path: original.workspace_path,
      workspace_name: original.workspace_name,
      parent_id: id,
      created_at: now,
      updated_at: now,
      message_count: original.message_count,
    });

    // 复制消息
    const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp').all(id) as Array<{
      id: string; session_id: string; role: string; content: string; timestamp: number; agent_id: string | null;
    }>;

    const insertMsg = db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp, agent_id)
      VALUES (@id, @session_id, @role, @content, @timestamp, @agent_id)
    `);

    // 维护旧消息 ID → 新消息 ID 的映射
    const idMap = new Map<string, string>();

    for (const msg of messages) {
      const newMsgId = generateId();
      idMap.set(msg.id, newMsgId);
      insertMsg.run({
        id: newMsgId,
        session_id: newId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        agent_id: msg.agent_id,
      });
    }

    // 复制工具调用（使用 idMap 关联到新消息）
    const toolCalls = db.prepare(
      `SELECT tc.* FROM tool_calls tc
       JOIN messages m ON tc.message_id = m.id
       WHERE m.session_id = ?`
    ).all(id) as Array<{
      id: string; message_id: string; name: string; args: string | null;
      output: string | null; is_error: number; status: string;
      started_at: number | null; completed_at: number | null;
    }>;

    if (toolCalls.length > 0) {
      const insertToolCall = db.prepare(`
        INSERT INTO tool_calls (id, message_id, name, args, output, is_error, status, started_at, completed_at)
        VALUES (@id, @message_id, @name, @args, @output, @is_error, @status, @started_at, @completed_at)
      `);

      for (const tc of toolCalls) {
        const newMsgId = idMap.get(tc.message_id);
        if (!newMsgId) continue; // 跳过无法映射的工具调用
        insertToolCall.run({
          id: generateId(),
          message_id: newMsgId,
          name: tc.name,
          args: tc.args,
          output: tc.output,
          is_error: tc.is_error,
          status: tc.status,
          started_at: tc.started_at,
          completed_at: tc.completed_at,
        });
      }
    }

    // 更新消息计数
    db.prepare('UPDATE sessions SET message_count = ? WHERE id = ?').run(messages.length, newId);
  });

  forkTx();
  return getSession(newId);
}

/** FTS5 搜索会话标题（降级为 LIKE 搜索） */
export function searchSessions(query: string): SessionRow[] {
  return listSessions({ search: query });
}
