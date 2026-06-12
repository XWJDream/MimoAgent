import { existsSync, readFileSync, renameSync, mkdirSync } from 'fs';
import { join } from 'path';
import { initDatabase, getDatabase } from './database.js';
import type { SessionRow } from './session-repo.js';

/** JSON 文件中的会话格式 */
interface JsonSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  workspacePath?: string;
  workspaceName?: string;
}

/** JSON 文件中的消息格式 */
interface JsonMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
  toolCalls?: unknown[];
  toolResult?: unknown;
  usage?: unknown;
}

/**
 * 从 JSON 文件迁移到 SQLite
 * 幂等：重复运行不产生重复数据（通过 INSERT OR IGNORE）
 */
export async function migrateFromJson(userDataPath: string): Promise<{ sessions: number; messages: number }> {
  // 确保数据库已初始化
  initDatabase(userDataPath);
  const db = getDatabase();

  const sessionsFile = join(userDataPath, 'sessions.json');
  const messagesDir = join(userDataPath, 'messages');

  let migratedSessions = 0;
  let migratedMessages = 0;

  // 迁移会话
  if (existsSync(sessionsFile)) {
    try {
      const raw = readFileSync(sessionsFile, 'utf-8');
      const sessions = JSON.parse(raw) as JsonSession[];

      if (Array.isArray(sessions)) {
        const insertSession = db.prepare(`
          INSERT OR IGNORE INTO sessions (id, title, workspace_path, workspace_name, status, created_at, updated_at, message_count)
          VALUES (@id, @title, @workspace_path, @workspace_name, 'active', @created_at, @updated_at, @message_count)
        `);

        const migrateTx = db.transaction(() => {
          for (const s of sessions) {
            if (!s.id || !s.name) continue;
            const result = insertSession.run({
              id: s.id,
              title: s.name,
              workspace_path: s.workspacePath || '',
              workspace_name: s.workspaceName || '',
              created_at: new Date(s.createdAt).getTime() || Date.now(),
              updated_at: new Date(s.updatedAt).getTime() || Date.now(),
              message_count: s.messageCount || 0,
            });
            if (result.changes > 0) migratedSessions++;
          }
        });
        migrateTx();

        // 重命名旧文件为 .bak
        try {
          renameSync(sessionsFile, sessionsFile + '.bak');
        } catch { /* 忽略重命名失败 */ }
      }
    } catch (err) {
      console.warn('[Migrate] Failed to migrate sessions:', err);
    }
  }

  // 迁移消息
  if (existsSync(messagesDir)) {
    try {
      const { readdirSync } = await import('fs');
      const files = readdirSync(messagesDir).filter(f => f.endsWith('.json'));

      const insertMsg = db.prepare(`
        INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp)
        VALUES (@id, @session_id, @role, @content, @timestamp)
      `);

      for (const file of files) {
        const sessionId = file.replace('.json', '');
        const filePath = join(messagesDir, file);

        try {
          const raw = readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);

          // 支持两种格式：直接数组，或 { messages, usage } 包装
          let messages: JsonMessage[] = [];
          if (Array.isArray(parsed)) {
            messages = parsed;
          } else if (parsed && Array.isArray(parsed.messages)) {
            messages = parsed.messages;
          }

          if (messages.length === 0) continue;

          const migrateMsgTx = db.transaction(() => {
            for (const msg of messages) {
              if (!msg.id || !msg.role) continue;
              const result = insertMsg.run({
                id: msg.id,
                session_id: sessionId,
                role: msg.role,
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                timestamp: msg.timestamp || Date.now(),
              });
              if (result.changes > 0) migratedMessages++;
            }

            // 更新会话的 message_count
            db.prepare('UPDATE sessions SET message_count = ? WHERE id = ?')
              .run(messages.length, sessionId);
          });
          migrateMsgTx();

          // 重命名旧文件为 .bak
          try {
            renameSync(filePath, filePath + '.bak');
          } catch { /* 忽略 */ }
        } catch (err) {
          console.warn(`[Migrate] Failed to migrate messages for ${sessionId}:`, err);
        }
      }
    } catch (err) {
      console.warn('[Migrate] Failed to read messages directory:', err);
    }
  }

  return { sessions: migratedSessions, messages: migratedMessages };
}
