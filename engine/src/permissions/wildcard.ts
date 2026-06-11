/**
 * 通配符匹配模块
 * 支持 glob 风格的模式匹配:
 *   *  — 匹配任意非斜杠字符
 *   ?  — 匹配单个非斜杠字符
 *   ** — 匹配任意路径（包括斜杠）
 *
 * 示例:
 *   wildcardMatch('.env', '*.env')        → true
 *   wildcardMatch('test.env', '*.env')    → true
 *   wildcardMatch('src/a.ts', 'src/**')   → true
 *   wildcardMatch('src/b/c.ts', 'src/**') → true
 */

/**
 * 将 glob 模式转换为正则表达式
 */
function globToRegex(glob: string): RegExp {
  // 空模式只匹配空字符串
  if (glob === '') return /^$/;

  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义正则特殊字符（保留 * ?）
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}') // 保护 **/ 组合
    .replace(/\*\*/g, '{{GLOBSTAR}}')          // 保护剩余的 **
    .replace(/\*/g, '[^/]*')                   // * 匹配非斜杠任意字符
    .replace(/\?/g, '[^/]')                    // ? 匹配单个非斜杠字符
    .replace(/{{GLOBSTAR_SLASH}}/g, '(.*\\/)?') // **/ 匹配零个或多个目录（含分隔符）
    .replace(/{{GLOBSTAR}}/g, '.*');            // ** 匹配任意字符（含斜杠）

  return new RegExp(`^${escaped}$`, 'i');
}

// 缓存已编译的正则，避免重复编译
const regexCache = new Map<string, RegExp>();

function getCachedRegex(pattern: string): RegExp {
  let cached = regexCache.get(pattern);
  if (!cached) {
    cached = globToRegex(pattern);
    regexCache.set(pattern, cached);
  }
  return cached;
}

/**
 * 通配符匹配
 *
 * @param text    待匹配的文本（文件路径或权限名）
 * @param pattern glob 模式
 * @returns 是否匹配
 */
export function wildcardMatch(text: string, pattern: string): boolean {
  // 精确匹配快速路径
  if (text === pattern) return true;

  // 规范化路径分隔符（Windows 反斜杠 → 正斜杠）
  const normalizedText = text.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  const regex = getCachedRegex(normalizedPattern);
  return regex.test(normalizedText);
}

/**
 * 清除正则缓存（用于测试）
 */
export function clearWildcardCache(): void {
  regexCache.clear();
}
