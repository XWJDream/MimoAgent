/**
 * Centralized error message mapping for user-friendly Chinese messages.
 * Translates technical English errors from the main process into friendly Chinese.
 */

// HTTP status code mapping
const HTTP_MESSAGES: Record<number, string> = {
  401: 'API Key 无效或已过期，请在设置中重新配置',
  403: '没有访问权限，请检查 API Key 的权限设置',
  404: 'API 接口地址不存在，请检查 API 地址配置',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '服务器网关错误，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
};

// Pattern-based error message mapping
const ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  // Configuration errors
  { pattern: /must be a string/, message: '设置项的值格式不正确，需要文字类型' },
  { pattern: /apiBase must be a string/, message: 'API 地址需要填写为文字' },
  { pattern: /apiBase must be an HTTP\(S\) URL/, message: 'API 地址格式不正确，请以 http:// 或 https:// 开头' },
  { pattern: /apiBase must be a valid URL/, message: 'API 地址不是有效的网址，请检查格式' },
  { pattern: /permissionMode is invalid/, message: '权限模式无效，请选择建议模式、自动编辑或全自动' },
  { pattern: /toolPreset must be plan or act/, message: '工具模式无效，请选择分析模式或操作模式' },
  { pattern: /maxTurns must be an integer/, message: '最大轮次需要是 1 到 200 之间的整数' },
  { pattern: /temperature must be between/, message: '温度值需要在 0 到 2 之间' },
  { pattern: /theme is invalid/, message: '主题设置无效，请选择深色或浅色' },
  { pattern: /sandboxEnabled must be a boolean/, message: '沙盒模式开关值无效' },
  { pattern: /reasoningEffort must be/, message: '思考强度需要选择低、中或高' },
  { pattern: /Unknown config key/, message: '不支持的设置项' },

  // Workspace and file errors
  { pattern: /Path is outside the active workspace/, message: '无法访问该路径，它不在当前工作目录范围内' },
  { pattern: /Workspace path must be an existing directory/, message: '选择的工作区路径不存在或不是一个文件夹' },
  { pattern: /Path is not a file/, message: '该路径不是一个文件' },
  { pattern: /File is too large to preview/, message: '文件太大，无法预览（超过 512KB）' },
  { pattern: /Path is required/, message: '请提供文件路径' },

  // Session errors
  { pattern: /Session not found/, message: '找不到该对话会话' },

  // Agent errors
  { pattern: /Agent not initialized/, message: 'AI 助手尚未初始化，请检查 API Key 设置' },
  { pattern: /Agent class not loaded/, message: 'AI 引擎加载失败，请重启应用或检查安装' },
  { pattern: /Failed to load mimo-agent/, message: 'AI 引擎文件加载失败，请确认应用安装完整' },
  { pattern: /Agent run was stopped/, message: '已停止' },
  { pattern: /aborted/, message: '已停止' },
  { pattern: /AbortError/, message: '已停止' },

  // Network errors
  { pattern: /ECONNREFUSED/, message: '网络连接失败，请检查网络设置和 API 地址' },
  { pattern: /ETIMEDOUT/, message: '网络连接超时，请检查网络设置' },
  { pattern: /ENOTFOUND/, message: '无法找到服务器，请检查 API 地址' },
  { pattern: /network.*error/i, message: '网络连接失败，请检查网络设置' },
  { pattern: /fetch.*failed/i, message: '网络请求失败，请检查网络连接' },

  // TTS errors
  { pattern: /请输入要转换的文本/, message: '请输入要转换的文本' },
  { pattern: /请先在设置中配置 API Key/, message: '请先在设置中配置 API Key' },
  { pattern: /未返回音频数据/, message: '未返回音频数据，请检查模型是否支持 TTS' },
  { pattern: /音频数据不存在/, message: '音频数据已过期，请重新生成' },
  { pattern: /已取消/, message: '已取消' },

  // Automation errors
  { pattern: /规则不存在/, message: '规则不存在' },
  { pattern: /缺少执行命令/, message: '缺少执行命令' },
  { pattern: /Blocked dangerous command/, message: '该命令被安全策略拦截，不允许执行危险操作' },
  { pattern: /不支持的动作类型/, message: '不支持的动作类型' },

  // API validation errors
  { pattern: /未配置 API Key/, message: '未配置 API Key' },
];

/**
 * Translate a technical error message to a user-friendly Chinese message.
 * @param error The technical error message (English or Chinese)
 * @returns User-friendly Chinese message
 */
export function translateError(error: string): string {
  if (!error) return '发生未知错误';

  // Check for HTTP status codes
  const httpMatch = error.match(/HTTP\s+(\d+)|status[:\s]+(\d+)/i);
  if (httpMatch) {
    const status = parseInt(httpMatch[1] || httpMatch[2]);
    if (HTTP_MESSAGES[status]) {
      return HTTP_MESSAGES[status];
    }
    if (status >= 400 && status < 500) {
      return `请求被拒绝（错误码 ${status}），请检查配置`;
    }
    if (status >= 500) {
      return `服务器异常（错误码 ${status}），请稍后重试`;
    }
  }

  // Check pattern matching
  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return message;
    }
  }

  // If it's already a Chinese message (starts with Chinese characters), return as-is
  if (/^[一-鿿]/.test(error)) {
    return error;
  }

  // Fallback: generic message
  return '操作失败，请稍后重试';
}

/**
 * Get error severity for UI styling.
 */
export function getErrorSeverity(error: string): 'info' | 'warning' | 'error' {
  if (error.includes('429') || error.includes('超时') || error.includes('频繁')) return 'warning';
  if (error.includes('401') || error.includes('403') || error.includes('无效')) return 'error';
  if (error.includes('网络') || error.includes('连接')) return 'warning';
  if (error.includes('已停止') || error.includes('已取消')) return 'info';
  return 'error';
}

/**
 * Get suggested action for the error.
 */
export function getErrorAction(error: string): { label: string; action: string } | null {
  if (error.includes('API Key') || error.includes('401') || error.includes('未配置')) {
    return { label: '前往设置', action: 'open-settings' };
  }
  if (error.includes('网络') || error.includes('连接') || error.includes('超时')) {
    return { label: '重试', action: 'retry' };
  }
  return null;
}
