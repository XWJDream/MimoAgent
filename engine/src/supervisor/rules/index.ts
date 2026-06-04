/**
 * Built-in supervisor rules
 */
import type { SupervisorRule } from '../types.js';

export const BUILTIN_RULES: SupervisorRule[] = [
  {
    id: 'large-file-write',
    name: '大文件写入警告',
    description: '写入超过 1000 行的文件时发出警告',
    severity: 'warning',
    check: (context) => {
      if (context.toolName === 'write_file' || context.toolName === 'edit_file') {
        const content = (context.args.content as string) || '';
        const lines = content.split('\n').length;
        if (lines > 1000) {
          return {
            ruleId: 'large-file-write',
            severity: 'warning',
            message: `写入大文件 (${lines} 行)`,
            suggestion: '考虑将大文件拆分为多个较小的模块',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'sensitive-file-edit',
    name: '敏感文件编辑警告',
    description: '编辑敏感配置文件时发出警告',
    severity: 'warning',
    check: (context) => {
      if (context.toolName === 'write_file' || context.toolName === 'edit_file') {
        const path = (context.args.path as string) || '';
        const sensitivePatterns = ['.env', 'config', 'secret', 'key', 'password', 'token'];
        if (sensitivePatterns.some(p => path.toLowerCase().includes(p))) {
          return {
            ruleId: 'sensitive-file-edit',
            severity: 'warning',
            message: `编辑敏感文件: ${path}`,
            suggestion: '确保不要提交敏感信息到版本控制',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'no-test-after-change',
    name: '修改后未测试',
    description: '代码修改后未运行测试',
    severity: 'info',
    check: (context) => {
      // Check if recent tool calls include code changes but no test runs
      const recentTools = context.conversation
        .slice(-10)
        .flatMap(m => m.content?.match(/tool_calls?.*?(\w+)/g) || []);

      const hasCodeChange = recentTools.some(t => ['write_file', 'edit_file'].includes(t));
      const hasTestRun = recentTools.some(t => t.includes('test') || t.includes('shell'));

      if (hasCodeChange && !hasTestRun) {
        return {
          ruleId: 'no-test-after-change',
          severity: 'info',
          message: '代码修改后未运行测试',
          suggestion: '建议运行测试确保修改不会引入问题',
        };
      }
      return null;
    },
  },
  {
    id: 'repeated-errors',
    name: '重复错误检测',
    description: '连续多次相同错误时发出警告',
    severity: 'error',
    check: (context) => {
      if (context.result?.isError) {
        const recentErrors = context.conversation
          .slice(-5)
          .filter(m => m.role === 'tool' && m.content?.includes('Error'));

        if (recentErrors.length >= 3) {
          return {
            ruleId: 'repeated-errors',
            severity: 'error',
            message: '连续多次出现错误',
            suggestion: '可能需要改变策略或寻求帮助',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'unsafe-shell-command',
    name: '不安全的 Shell 命令',
    description: '检测潜在危险的 Shell 命令',
    severity: 'error',
    check: (context) => {
      if (context.toolName === 'shell') {
        const command = (context.args.command as string) || '';
        const dangerousPatterns = [
          /\brm\s+-rf\b/,
          /\bmkfs\b/,
          /\bdd\s+if=/,
          /\bformat\s+[a-z]:/i,
          /\bdel\s+\/[a-z]*\s+[a-z]:\\/i,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(command)) {
            return {
              ruleId: 'unsafe-shell-command',
              severity: 'error',
              message: `检测到不安全的命令: ${command}`,
              suggestion: '请确认命令是否安全，避免执行破坏性操作',
            };
          }
        }
      }
      return null;
    },
  },
  {
    id: 'context-overflow-warning',
    name: '上下文溢出警告',
    description: '上下文即将超出窗口限制',
    severity: 'warning',
    check: (context) => {
      // Estimate context size
      const totalChars = context.conversation.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      const estimatedTokens = Math.ceil(totalChars / 3);

      if (estimatedTokens > 80000) {
        return {
          ruleId: 'context-overflow-warning',
          severity: 'warning',
          message: `上下文较大 (~${estimatedTokens.toLocaleString()} tokens)`,
          suggestion: '考虑压缩对话历史或开始新会话',
        };
      }
      return null;
    },
  },
  {
    id: 'code-quality-check',
    name: '代码质量检查',
    description: '检查代码质量问题',
    severity: 'info',
    check: (context) => {
      if (context.toolName === 'write_file' || context.toolName === 'edit_file') {
        const content = (context.args.content as string) || '';

        // Check for common issues
        const issues: string[] = [];

        if (content.includes('console.log') && !content.includes('// debug')) {
          issues.push('包含 console.log 语句');
        }

        if (content.includes('TODO') || content.includes('FIXME')) {
          issues.push('包含 TODO/FIXME 注释');
        }

        if (content.includes('any') && content.includes('as any')) {
          issues.push('使用了 any 类型');
        }

        if (issues.length > 0) {
          return {
            ruleId: 'code-quality-check',
            severity: 'info',
            message: `代码质量问题: ${issues.join(', ')}`,
            suggestion: '考虑在提交前修复这些问题',
          };
        }
      }
      return null;
    },
  },
];

/**
 * Register all built-in rules
 */
export function registerBuiltinRules(manager: { registerRule(rule: SupervisorRule): void }): void {
  for (const rule of BUILTIN_RULES) {
    manager.registerRule(rule);
  }
}
