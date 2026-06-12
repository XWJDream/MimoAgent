/**
 * Context overflow error pattern matching.
 * Covers error messages from major LLM providers.
 */

const OVERFLOW_PATTERNS: RegExp[] = [
  // OpenAI
  /maximum.*context.*length/i,
  /context.*window.*exceeded/i,
  /too many tokens/i,

  // Anthropic
  /prompt.*too.*long/i,
  /exceeds.*context.*limit/i,
  /context.*length.*exceeded/i,

  // Google
  /context.*length.*exceed/i,
  /maximum.*input.*token/i,

  // Azure
  /context.*window.*exceeded/i,
  /maximum.*token.*limit/i,

  // Generic
  /context.*overflow/i,
  /token.*limit.*exceed/i,
  /input.*too.*long/i,
  /request.*too.*large/i,
  /max.*context/i,
  /context.*full/i,
];

export interface ParsedError {
  type: 'context_overflow' | 'api_error' | 'auth_error' | 'rate_limit' | 'network_error' | 'unknown';
  message: string;
  originalError: Error;
  retryable: boolean;
  suggestedAction?: string;
}

/**
 * Parse an API error and classify its type.
 */
export function parseAPIError(error: Error): ParsedError {
  const message = error.message || String(error);

  // Context overflow
  for (const pattern of OVERFLOW_PATTERNS) {
    if (pattern.test(message)) {
      return {
        type: 'context_overflow',
        message: '上下文窗口已满，请压缩上下文或清空聊天后重试',
        originalError: error,
        retryable: true,
        suggestedAction: 'compact',
      };
    }
  }

  // Auth errors
  if (/401|unauthorized|invalid.*api.*key|authentication/i.test(message)) {
    return {
      type: 'auth_error',
      message: 'API Key 无效或已过期，请检查设置',
      originalError: error,
      retryable: false,
      suggestedAction: 'settings',
    };
  }

  // Rate limiting
  if (/429|rate.*limit|too.*many.*requests|quota/i.test(message)) {
    return {
      type: 'rate_limit',
      message: '请求过于频繁，请稍后重试',
      originalError: error,
      retryable: true,
    };
  }

  // Network errors
  if (/network|fetch|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return {
      type: 'network_error',
      message: '网络连接失败，请检查网络设置',
      originalError: error,
      retryable: true,
    };
  }

  return {
    type: 'unknown',
    message,
    originalError: error,
    retryable: false,
  };
}

/**
 * Check if an error is a context overflow error.
 */
export function isContextOverflow(error: Error): boolean {
  return parseAPIError(error).type === 'context_overflow';
}
