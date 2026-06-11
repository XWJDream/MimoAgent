import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { MemoryScope, MemoryType } from './database.js';

interface DiskFile {
  path: string;       // 绝对路径
  relPath: string;    // 相对于 memoryRoot 的路径
  scope: MemoryScope;
  scopeId: string;
  type: MemoryType;
  body: string;
  fingerprint: string;
}

/**
 * 计算文件 fingerprint：文件大小 + 修改时间
 */
function computeFingerprint(filePath: string): string {
  const stat = statSync(filePath);
  return `${stat.size}-${stat.mtimeMs}`;
}

/**
 * 从相对路径推断 scope、scopeId 和 type
 *
 * 目录结构：
 *   global/MEMORY.md          -> scope=global, type=memory
 *   project/MEMORY.md         -> scope=project, type=memory
 *   session/<sid>/checkpoint.md -> scope=session, scopeId=sid, type=checkpoint
 *   session/<sid>/notes.md    -> scope=session, scopeId=sid, type=notes
 */
function inferMetadata(relPath: string): { scope: MemoryScope; scopeId: string; type: MemoryType } {
  const parts = relPath.replace(/\\/g, '/').split('/');

  if (parts[0] === 'global') {
    return { scope: 'global', scopeId: '', type: 'memory' };
  }

  if (parts[0] === 'project') {
    return { scope: 'project', scopeId: '', type: 'memory' };
  }

  if (parts[0] === 'session' && parts.length >= 3) {
    const scopeId = parts[1];
    const filename = parts[2].toLowerCase();
    if (filename.includes('checkpoint')) {
      return { scope: 'session', scopeId, type: 'checkpoint' };
    }
    if (filename.includes('note')) {
      return { scope: 'session', scopeId, type: 'notes' };
    }
    return { scope: 'session', scopeId, type: 'free' };
  }

  return { scope: 'global', scopeId: '', type: 'free' };
}

/**
 * 递归扫描记忆目录下所有 .md 文件
 */
function scanMemoryDir(memoryRoot: string): DiskFile[] {
  const results: DiskFile[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
        try {
          const relPath = relative(memoryRoot, fullPath).replace(/\\/g, '/');
          const { scope, scopeId, type } = inferMetadata(relPath);
          const body = readFileSync(fullPath, 'utf-8');
          const fingerprint = computeFingerprint(fullPath);
          results.push({ path: fullPath, relPath, scope, scopeId, type, body, fingerprint });
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  }

  walk(memoryRoot);
  return results;
}

/**
 * 磁盘-数据库同步（reconcile）
 *
 * 1. 扫描磁盘文件
 * 2. 对比数据库中已有条目的 fingerprint
 * 3. 增量更新：只写入新增或变更的文件
 * 4. 剪枝：删除数据库中已不存在于磁盘的条目
 */
export function reconcileDiskAndDb(db: Database, memoryRoot: string): { added: number; updated: number; removed: number } {
  const diskFiles = scanMemoryDir(memoryRoot);
  const diskPaths = new Set(diskFiles.map((f) => f.path));

  // 获取数据库中所有条目
  const dbEntries = db.prepare('SELECT id, path, fingerprint FROM memory_entries').all() as Array<{
    id: number;
    path: string;
    fingerprint: string;
  }>;
  const dbPathMap = new Map(dbEntries.map((e) => [e.path, e]));

  let added = 0;
  let updated = 0;
  let removed = 0;

  const upsert = db.prepare(`
    INSERT INTO memory_entries (path, scope, scope_id, type, body, fingerprint, last_indexed_at)
    VALUES (@path, @scope, @scope_id, @type, @body, @fingerprint, @last_indexed_at)
    ON CONFLICT(path) DO UPDATE SET
      scope = excluded.scope,
      scope_id = excluded.scope_id,
      type = excluded.type,
      body = excluded.body,
      fingerprint = excluded.fingerprint,
      last_indexed_at = excluded.last_indexed_at
  `);

  const deleteById = db.prepare('DELETE FROM memory_entries WHERE id = ?');

  const now = Date.now();

  // 批量处理新增/更新
  const upsertMany = db.transaction((files: DiskFile[]) => {
    for (const file of files) {
      const existing = dbPathMap.get(file.path);
      if (!existing) {
        // 新增
        upsert.run({
          path: file.path,
          scope: file.scope,
          scope_id: file.scopeId,
          type: file.type,
          body: file.body,
          fingerprint: file.fingerprint,
          last_indexed_at: now,
        });
        added++;
      } else if (existing.fingerprint !== file.fingerprint) {
        // 变更
        upsert.run({
          path: file.path,
          scope: file.scope,
          scope_id: file.scopeId,
          type: file.type,
          body: file.body,
          fingerprint: file.fingerprint,
          last_indexed_at: now,
        });
        updated++;
      }
    }
  });

  upsertMany(diskFiles);

  // 剪枝：删除磁盘中已不存在的条目
  const pruneMany = db.transaction((entries: Array<{ id: number; path: string }>) => {
    for (const entry of entries) {
      if (!diskPaths.has(entry.path)) {
        deleteById.run(entry.id);
        removed++;
      }
    }
  });

  pruneMany(dbEntries);

  return { added, updated, removed };
}
