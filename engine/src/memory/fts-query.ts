/**
 * FTS5 查询构建器 — 将用户输入转为 FTS5 MATCH 表达式
 * 使用 OR 连接（靠 BM25 排名过滤噪声，而不是 AND 截断太多结果）
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens = raw.match(/[\p{L}\p{N}_]+/gu)?.map((t) => t.trim()).filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replaceAll('"', '')}"`).join(' OR ');
}
