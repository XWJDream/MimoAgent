// Lightweight regex-based syntax highlighter (no WASM dependency)
// Supports the most common languages with token-level coloring

const KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'let', 'module', 'namespace', 'new',
  'null', 'of', 'package', 'private', 'protected', 'public', 'readonly', 'return',
  'set', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'type',
  'typeof', 'undefined', 'var', 'void', 'while', 'with', 'yield', 'def', 'elif',
  'except', 'finally', 'global', 'lambda', 'nonlocal', 'pass', 'raise', 'with',
  'as', 'and', 'or', 'not', 'is', 'fn', 'mod', 'use', 'struct', 'impl', 'trait',
  'pub', 'mut', 'ref', 'match', 'loop', 'move', 'crate', 'self', 'Self', 'where',
  'async', 'dyn', 'unsafe',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightTokens(code: string): string {
  // Tokenize: strings, comments, numbers, keywords, identifiers, operators, punctuation
  // Uses [\s\S] for multi-line string support and trailing . as catch-all fallback
  const tokenRegex = /(["'`])(?:(?!\1|\\)[\s\S]|\\.)*\1|\/\/.*$|\/\*[\s\S]*?\*\/|#.*$|\b\d+\.?\d*(?:e[+-]?\d+)?\b|\b[a-zA-Z_]\w*\b|[{}()[\];,.:]+|[=!<>]=?=?|[+\-*/%&|^~?]+|\s+|./gm;

  let result = '';
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const token = match[0];

    if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      result += `<span style="color:#a5d6ff">${escapeHtml(token)}</span>`;
    } else if (token.startsWith('//') || token.startsWith('#') || token.startsWith('/*')) {
      result += `<span style="color:#8b949e;font-style:italic">${escapeHtml(token)}</span>`;
    } else if (/^\d/.test(token)) {
      result += `<span style="color:#79c0ff">${escapeHtml(token)}</span>`;
    } else if (KEYWORDS.has(token)) {
      result += `<span style="color:#ff7b72">${escapeHtml(token)}</span>`;
    } else if (/^[a-zA-Z_]\w*$/.test(token)) {
      // Check if it looks like a function call
      const nextChar = code[match.index + token.length];
      if (nextChar === '(') {
        result += `<span style="color:#d2a8ff">${escapeHtml(token)}</span>`;
      } else if (token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase()) {
        result += `<span style="color:#ffa657">${escapeHtml(token)}</span>`;
      } else {
        result += escapeHtml(token);
      }
    } else {
      result += escapeHtml(token);
    }
  }

  return result;
}

export function highlightCode(code: string, _lang: string): Promise<string> {
  const highlighted = highlightTokens(code);
  return Promise.resolve(`<pre><code>${highlighted}</code></pre>`);
}

export function isHighlightReady(): boolean {
  return true;
}
