import { describe, it, expect } from 'vitest';
import {
  validateToolArgs,
  validateToolResult,
  generateReflectionPrompt,
  createValidator,
} from './validator.js';

describe('Validator', () => {
  describe('validateToolArgs()', () => {
    it('should pass for valid args', () => {
      const result = validateToolArgs('read_file', { file_path: '/test/file.txt' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for null args', () => {
      const result = validateToolArgs('read_file', null as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail for missing required params', () => {
      const result = validateToolArgs('read_file', {}, ['file_path']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('file_path');
    });

    it('should warn for empty string values', () => {
      const result = validateToolArgs('read_file', { file_path: '' });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn for null values', () => {
      const result = validateToolArgs('read_file', { file_path: null });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('validateToolResult()', () => {
    it('should pass for successful result', () => {
      const result = validateToolResult('read_file', {
        output: 'file content',
        isError: false,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for error result', () => {
      const result = validateToolResult('read_file', {
        output: 'Error: File not found',
        isError: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn for empty output', () => {
      const result = validateToolResult('shell', {
        output: '',
        isError: false,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate read_file errors', () => {
      const result = validateToolResult('read_file', {
        output: 'Error reading file: ENOENT',
        isError: false,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate write_file success', () => {
      const result = validateToolResult('write_file', {
        output: 'File written successfully: /test/file.txt',
        isError: false,
      });
      expect(result.valid).toBe(true);
    });

    it('should validate shell non-zero exit', () => {
      const result = validateToolResult('shell', {
        output: 'Error: Command exited with code 1',
        isError: false,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should suggest for empty glob results', () => {
      const result = validateToolResult('glob', {
        output: 'No files found',
        isError: false,
      });
      expect(result.valid).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should validate web_fetch errors', () => {
      const result = validateToolResult('web_fetch', {
        output: 'Error: HTTP 404 Not Found',
        isError: false,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateReflectionPrompt()', () => {
    it('should return empty for successful results', () => {
      const prompt = generateReflectionPrompt('test task', [
        { tool: 'read_file', result: { output: 'content', isError: false } },
      ]);
      expect(prompt).toBe('');
    });

    it('should generate prompt for errors', () => {
      const prompt = generateReflectionPrompt('test task', [
        { tool: 'read_file', result: { output: 'Error', isError: true } },
      ]);
      expect(prompt).toContain('Self-Reflection');
      expect(prompt).toContain('❌');
    });

    it('should generate prompt for warnings', () => {
      const prompt = generateReflectionPrompt('test task', [
        { tool: 'shell', result: { output: '', isError: false } },
      ]);
      expect(prompt).toContain('Self-Reflection');
      expect(prompt).toContain('⚠️');
    });

    it('should include warnings in reflection', () => {
      const prompt = generateReflectionPrompt('test task', [
        { tool: 'shell', result: { output: '', isError: false } },
      ]);
      expect(prompt).toContain('⚠️');
      expect(prompt).toContain('empty output');
    });

    it('should include reflection questions', () => {
      const prompt = generateReflectionPrompt('test task', [
        { tool: 'read_file', result: { output: 'Error', isError: true } },
      ]);
      expect(prompt).toContain('Did your actions achieve');
      expect(prompt).toContain('Were there any errors');
    });
  });

  describe('createValidator()', () => {
    it('should create validator with default options', () => {
      const validator = createValidator();
      expect(validator.validateToolArgs).toBeDefined();
      expect(validator.validateToolResult).toBeDefined();
      expect(validator.generateReflectionPrompt).toBeDefined();
      expect(validator.shouldRetry).toBeDefined();
    });

    it('should skip validation when disabled', () => {
      const validator = createValidator({
        validateJsonFormat: false,
        validateToolResults: false,
      });

      const argsResult = validator.validateToolArgs('test', null as any);
      expect(argsResult.valid).toBe(true);

      const toolResult = validator.validateToolResult('test', { output: '', isError: true });
      expect(toolResult.valid).toBe(true);
    });

    it('should skip reflection when disabled', () => {
      const validator = createValidator({ enableReflection: false });
      const prompt = validator.generateReflectionPrompt('task', [
        { tool: 'test', result: { output: 'Error', isError: true } },
      ]);
      expect(prompt).toBe('');
    });

    it('should determine retry eligibility', () => {
      const validator = createValidator({ maxRetries: 2 });

      expect(validator.shouldRetry({ valid: false, errors: [], warnings: [], suggestions: [] }, 0)).toBe(true);
      expect(validator.shouldRetry({ valid: false, errors: [], warnings: [], suggestions: [] }, 1)).toBe(true);
      expect(validator.shouldRetry({ valid: false, errors: [], warnings: [], suggestions: [] }, 2)).toBe(false);
      expect(validator.shouldRetry({ valid: true, errors: [], warnings: [], suggestions: [] }, 0)).toBe(false);
    });
  });
});
