import type { ToolResult } from '../tools/base.js';

/**
 * Validation result for agent output
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Validate JSON format of tool arguments */
  validateJsonFormat?: boolean;
  /** Validate tool execution results */
  validateToolResults?: boolean;
  /** Enable self-reflection mechanism */
  enableReflection?: boolean;
  /** Max retry attempts for failed validation */
  maxRetries?: number;
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: ValidationOptions = {
  validateJsonFormat: true,
  validateToolResults: true,
  enableReflection: true,
  maxRetries: 2,
};

/**
 * Validate tool call arguments
 */
export function validateToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  expectedParams?: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check if args is a valid object
  if (!args || typeof args !== 'object') {
    errors.push(`Tool "${toolName}" arguments must be an object`);
    return { valid: false, errors, warnings, suggestions };
  }

  // Check for required parameters if specified
  if (expectedParams && expectedParams.length > 0) {
    for (const param of expectedParams) {
      if (!(param in args)) {
        errors.push(`Tool "${toolName}" missing required parameter: ${param}`);
      }
    }
  }

  // Check for common issues
  for (const [key, value] of Object.entries(args)) {
    // Check for empty strings
    if (typeof value === 'string' && value.trim() === '') {
      warnings.push(`Tool "${toolName}" parameter "${key}" is empty`);
    }

    // Check for null/undefined values
    if (value === null || value === undefined) {
      warnings.push(`Tool "${toolName}" parameter "${key}" is null/undefined`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate tool execution result
 */
export function validateToolResult(
  toolName: string,
  result: ToolResult,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check if result has required fields
  if (!result.output && result.output !== '') {
    errors.push(`Tool "${toolName}" result missing output`);
  }

  // Check for error results
  if (result.isError) {
    errors.push(`Tool "${toolName}" returned error: ${result.output}`);
  }

  // Check for empty output
  if (result.output === '' || result.output === '(no output)') {
    warnings.push(`Tool "${toolName}" returned empty output`);
  }

  // Tool-specific validations
  switch (toolName) {
    case 'read_file':
      if (result.output?.includes('Error reading file')) {
        errors.push(`Failed to read file: ${result.output}`);
      }
      break;

    case 'write_file':
      if (!result.output?.includes('File written successfully')) {
        warnings.push('Write operation may not have completed successfully');
      }
      break;

    case 'edit_file':
      if (!result.output?.includes('File edited successfully')) {
        warnings.push('Edit operation may not have completed successfully');
      }
      break;

    case 'shell':
      if (result.output?.includes('Command exited with code')) {
        const match = result.output.match(/exited with code (\d+)/);
        if (match && parseInt(match[1]) !== 0) {
          warnings.push(`Shell command exited with non-zero code: ${match[1]}`);
        }
      }
      break;

    case 'glob':
      if (result.output === 'No files found') {
        suggestions.push('Try a different search pattern or path');
      }
      break;

    case 'grep':
      if (result.output === 'No matches found.') {
        suggestions.push('Try a different search pattern or broaden the search scope');
      }
      break;

    case 'web_fetch':
      if (result.output?.includes('Error:')) {
        errors.push(`Web fetch failed: ${result.output}`);
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Generate self-reflection prompt for the agent
 */
export function generateReflectionPrompt(
  _task: string,
  results: Array<{ tool: string; result: ToolResult }>,
): string {
  const hasErrors = results.some((r) => r.result.isError);
  const hasWarnings = results.some((r) => {
    const validation = validateToolResult(r.tool, r.result);
    return validation.warnings.length > 0;
  });

  if (!hasErrors && !hasWarnings) {
    return ''; // No reflection needed
  }

  let prompt = '\n\n--- Self-Reflection ---\n';
  prompt += 'Please review the results of your actions:\n\n';

  for (const { tool, result } of results) {
    const validation = validateToolResult(tool, result);

    if (validation.errors.length > 0) {
      prompt += `❌ ${tool}: ${validation.errors.join(', ')}\n`;
    }
    if (validation.warnings.length > 0) {
      prompt += `⚠️ ${tool}: ${validation.warnings.join(', ')}\n`;
    }
    if (validation.suggestions.length > 0) {
      prompt += `💡 ${tool}: ${validation.suggestions.join(', ')}\n`;
    }
  }

  prompt += '\nConsider:\n';
  prompt += '1. Did your actions achieve the intended goal?\n';
  prompt += '2. Were there any errors that need to be addressed?\n';
  prompt += '3. Should you retry any failed operations?\n';
  prompt += '4. Are there alternative approaches to try?\n';

  return prompt;
}

/**
 * Create a validator with options
 */
export function createValidator(options: ValidationOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return {
    validateToolArgs: (toolName: string, args: Record<string, unknown>, expectedParams?: string[]) => {
      if (!opts.validateJsonFormat) return { valid: true, errors: [], warnings: [], suggestions: [] };
      return validateToolArgs(toolName, args, expectedParams);
    },

    validateToolResult: (toolName: string, result: ToolResult) => {
      if (!opts.validateToolResults) return { valid: true, errors: [], warnings: [], suggestions: [] };
      return validateToolResult(toolName, result);
    },

    generateReflectionPrompt: (task: string, results: Array<{ tool: string; result: ToolResult }>) => {
      if (!opts.enableReflection) return '';
      return generateReflectionPrompt(task, results);
    },

    shouldRetry: (validation: ValidationResult, retryCount: number) => {
      return !validation.valid && retryCount < (opts.maxRetries ?? 2);
    },
  };
}
