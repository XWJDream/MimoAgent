import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export function initDatabase(userDataPath: string): Database.Database {
  if (db) return db;
  const dbPath = path.join(userDataPath, 'mimo-sessions.db');
  db = new Database(dbPath);

  // WAL 模式优化并发读写
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  // 创建表结构
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      workspace_path TEXT,
      workspace_name TEXT,
      parent_id TEXT,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      message_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      agent_id TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      name TEXT NOT NULL,
      args TEXT,
      output TEXT,
      is_error INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      started_at INTEGER,
      completed_at INTEGER,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      message_id TEXT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cached_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_tool_calls_message ON tool_calls(message_id);
    CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_records(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_title ON sessions(title);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

/** 仅用于测试：重置数据库单例 */
export function _resetDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
