import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type Database from 'better-sqlite3';
import { getDatabase, closeDatabase, type MemoryScope, type MemoryType } from './database.js';
import { buildFtsQuery } from './fts-query.js';
import { reconcileDiskAndDb } from './reconcile.js';

export interface SearchResult {
  path: string;
  scope: MemoryScope;
  scope_id: string;
  type: MemoryType;
  body: string;
  score: number;
}

export interface SearchOptions {
  /** 最大返回条数，默认 10 */
  limit?: number;
  /** 按 scope 过滤 */
  scope?: MemoryScope;
  /** 按 scope_id 过滤（如 session ID） */
  scopeId?: string;
  /** 相对分数阈值（0-1），默认 0.15 */
  scoreThreshold?: number;
}

export class MemoryService {
  private db: Database.Database;
  private memoryRoot: string;

  constructor(userDataPath: string, memoryRoot: string) {
    this.memoryRoot = memoryRoot;
    this.db = getDatabase(userDataPath);

    // 确保记忆目录结构存在
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const dirs = [
      join(this.memoryRoot, 'global'),
      join(this.memoryRoot, 'project'),
    ];
    for (const dir of dirs) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * BM25 搜索记忆
   * 使用 OR 连接查询词，靠 BM25 排名，相对分数过滤（阈值 0.15）
   */
  search(query: string, options?: SearchOptions): SearchResult[] {
    const limit = options?.limit ?? 10;
    const scoreThreshold = options?.scoreThreshold ?? 0.15;

    const ftsQuery = buildFtsQuery(query);
    if (!ftsQuery) return [];

    // 构建 SQL 查询
    let sql = `
      SELECT
        me.path,
        me.scope,
        me.scope_id,
        me.type,
        me.body,
        bm25(memory_fts_idx) AS score
      FROM memory_fts_idx
      JOIN memory_entries me ON me.id = memory_fts_idx.rowid
      WHERE memory_fts_idx MATCH @query
    `;

    const params: Record<string, unknown> = { query: ftsQuery };

    // 可选的 scope 过滤
    if (options?.scope) {
      sql += ` AND me.scope = @scope`;
      params.scope = options.scope;
    }
    if (options?.scopeId !== undefined) {
      sql += ` AND me.scope_id = @scopeId`;
      params.scopeId = options.scopeId;
    }

    sql += ` ORDER BY score ASC`;  // BM25 分数越低越相关
    sql += ` LIMIT @limit`;
    params.limit = limit * 3; // 多取一些用于相对分数过滤

    try {
      const rows = this.db.prepare(sql).all(params) as Array<{
        path: string;
        scope: MemoryScope;
        scope_id: string;
        type: MemoryType;
        body: string;
        score: number;
      }>;

      if (rows.length === 0) return [];

      // BM25 分数是负数（越小越相关），取绝对值后越大越相关
      const maxScore = Math.abs(rows[0].score);
      if (maxScore === 0) return [];

      // 相对分数过滤：保留 >= 最高分 * scoreThreshold 的结果
      const threshold = maxScore * scoreThreshold;
      const filtered = rows
        .filter((row) => Math.abs(row.score) >= threshold)
        .slice(0, limit)
        .map((row) => ({
          path: row.path,
          scope: row.scope,
          scope_id: row.scope_id,
          type: row.type,
          body: row.body,
          score: Math.abs(row.score) / maxScore,  // 归一化到 0-1
        }));

      return filtered;
    } catch (err) {
      // FTS 查询语法错误时静默返回空
      console.warn('[MemoryService] Search error:', err);
      return [];
    }
  }

  /**
   * 触发磁盘-数据库同步
   */
  reconcile(): { added: number; updated: number; removed: number } {
    return reconcileDiskAndDb(this.db, this.memoryRoot);
  }

  /**
   * 添加记忆条目（同时写入磁盘和数据库）
   */
  addMemory(
    filePath: string,
    body: string,
    scope: MemoryScope,
    scopeId: string,
    type: MemoryType,
  ): void {
    // 确保目录存在
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // 写入磁盘
    writeFileSync(filePath, body, 'utf-8');

    // 写入数据库
    const stat = require('node:fs').statSync(filePath);
    const fingerprint = `${stat.size}-${stat.mtimeMs}`;

    this.db.prepare(`
      INSERT INTO memory_entries (path, scope, scope_id, type, body, fingerprint, last_indexed_at)
      VALUES (@path, @scope, @scope_id, @type, @body, @fingerprint, @last_indexed_at)
      ON CONFLICT(path) DO UPDATE SET
        body = excluded.body,
        fingerprint = excluded.fingerprint,
        last_indexed_at = excluded.last_indexed_at
    `).run({
      path: filePath,
      scope,
      scope_id: scopeId,
      type,
      body,
      fingerprint,
      last_indexed_at: Date.now(),
    });
  }

  /**
   * 删除记忆条目（同时删除磁盘文件和数据库记录）
   */
  removeMemory(filePath: string): void {
    // 删除磁盘文件
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    // 删除数据库记录（触发器会自动清理 FTS 索引）
    this.db.prepare('DELETE FROM memory_entries WHERE path = ?').run(filePath);
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    closeDatabase();
  }
}
