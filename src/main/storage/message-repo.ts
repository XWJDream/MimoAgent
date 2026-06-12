import { randomBytes } from 'crypto';
import { getDatabase } from './database.js';

/** 消息行结构 */
export interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: number;
  agent_id: string | null;
}

export interface MessageListOptions {
  limit?: number;
  cursor?: number;  // 游标分页：timestamp < cursor
}

function generateId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

/** 列出会话消息（支持游标分页） */
export function listMessages(sessionId: string, options?: MessageListOptions): MessageRow[] {
  const db = getDatabase();
  let sql = 'SELECT * FROM messages WHERE session_id = ?';
  const params: unknown[] = [sessionId];

  if (options?.cursor) {
    sql += ' AND timestamp < ?';
    params.push(options.cursor);
  }

  sql += ' ORDER BY timestamp ASC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(sql).all(...params) as MessageRow[];
}

/** 批量保存消息（事务内执行，先删后插） */
export function saveMessages(sessionId: string, messages: Array<{
  id?: string;
  role: string;
  content: string;
  timestamp: number;
  agentId?: string;
}>): number {
  const db = getDatabase();

  const saveTx = db.transaction(() => {
    // 删除该会话的旧消息
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);

    if (messages.length === 0) return 0;

    const insert = db.prepare(`
      INSERT INTO messages (id, session_id, role, content, timestamp, agent_id)
      VALUES (@id, @session_id, @role, @content, @timestamp, @agent_id)
    `);

    for (const msg of messages) {
      insert.run({
        id: msg.id || generateId(),
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        agent_id: msg.agentId || null,
      });
    }

    // 更新会话的 message_count
    db.prepare('UPDATE sessions SET message_count = ?, updated_at = ? WHERE id = ?')
      .run(messages.length, Date.now(), sessionId);

    return messages.length;
  });

  return saveTx();
}

/** 追加单条消息 */
export function appendMessage(sessionId: string, message: {
  id?: string;
  role: string;
  content: string;
  timestamp: number;
  agentId?: string;
}): MessageRow {
  const db = getDatabase();
  const id = message.id || generateId();

  db.prepare(`
    INSERT INTO messages (id, session_id, role, content, timestamp, agent_id)
    VALUES (@id, @session_id, @role, @content, @timestamp, @agent_id)
  `).run({
    id,
    session_id: sessionId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    agent_id: message.agentId || null,
  });

  // 更新会话的 message_count 和 updated_at
  db.prepare('UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?')
    .run(Date.now(), sessionId);

  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow;
}

/** 删除会话的所有消息 */
export function deleteMessagesBySession(sessionId: string): number {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
  db.prepare('UPDATE sessions SET message_count = 0, updated_at = ? WHERE id = ?')
    .run(Date.now(), sessionId);
  return result.changes;
}

/** 获取消息数量 */
export function getMessageCount(sessionId: string): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?').get(sessionId) as { count: number };
  return row.count;
}
