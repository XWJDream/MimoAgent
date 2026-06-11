import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type MemoryScope = 'global' | 'project' | 'session';
export type MemoryType = 'memory' | 'checkpoint' | 'notes' | 'free';

export interface MemoryEntry {
  id: number;
  path: string;
  scope: MemoryScope;
  scope_id: string;
  type: MemoryType;
  body: string;
  fingerprint: string;
  last_indexed_at: number;
}

let _db: Database.Database | null = null;

/**
 * 获取或初始化 SQLite 数据库实例
 * 数据库文件存放在 userData 目录下：<userData>/mimo-memory.db
 */
export function getDatabase(userDataPath: string): Database.Database {
  if (_db) return _db;

  const dbDir = userDataPath;
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const dbPath = join(dbDir, 'mimo-memory.db');
  _db = new Database(dbPath);

  // 启用 WAL 模式提升并发性能
  _db.pragma('journal_mode = WAL');

  // 创建内容表
  _db.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      scope TEXT NOT NULL CHECK(scope IN ('global', 'project', 'session')),
      scope_id TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('memory', 'checkpoint', 'notes', 'free')),
      body TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      last_indexed_at INTEGER NOT NULL
    )
  `);

  // 创建 FTS5 虚拟表（content table 模式）
  _db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts_idx USING fts5(
      body,
      content='memory_entries',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 1'
    )
  `);

  // 创建触发器：INSERT 同步
  _db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries
    BEGIN
      INSERT INTO memory_fts_idx(rowid, body) VALUES (new.id, new.body);
    END
  `);

  // 创建触发器：DELETE 同步（必须使用 'delete' 魔法命令）
  _db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_delete AFTER DELETE ON memory_entries
    BEGIN
      INSERT INTO memory_fts_idx(memory_fts_idx, rowid, body) VALUES('delete', OLD.id, OLD.body);
    END
  `);

  // 创建触发器：UPDATE 同步（先 delete 旧的，再 insert 新的）
  _db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_entries
    BEGIN
      INSERT INTO memory_fts_idx(memory_fts_idx, rowid, body) VALUES('delete', OLD.id, OLD.body);
      INSERT INTO memory_fts_idx(rowid, body) VALUES (new.id, new.body);
    END
  `);

  return _db;
}

/**
 * 关闭数据库连接（用于测试或应用退出时）
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * 重置数据库实例（仅用于测试）
 */
export function resetDatabase(): void {
  _db = null;
}
