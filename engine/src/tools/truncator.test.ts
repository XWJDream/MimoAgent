import { describe, it, expect } from 'vitest';
import { truncateOutput } from './truncator.js';

describe('truncateOutput', () => {
  // -----------------------------------------------------------------------
  // Short output — no truncation
  // -----------------------------------------------------------------------
  it('should not truncate output shorter than maxLength', () => {
    const short = 'hello world';
    const result = truncateOutput(short);
    expect(result.truncated).toBe(false);
    expect(result.output).toBe(short);
    expect(result.originalLength).toBe(short.length);
    expect(result.truncatedLength).toBe(short.length);
    expect(result.hint).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Generic truncation — head + tail
  // -----------------------------------------------------------------------
  it('should truncate long output keeping head and tail', () => {
    const long = 'A'.repeat(30_000) + 'B'.repeat(30_000);
    const result = truncateOutput(long, { maxOutputLength: 10_000 });
    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBe(60_000);
    expect(result.output.length).toBeLessThan(60_000);
    // Head should start with A, tail should end with B
    expect(result.output.startsWith('A')).toBe(true);
    expect(result.output.endsWith('B')).toBe(true);
    expect(result.hint).toContain('已截断');
  });

  it('should respect custom headRatio and tailRatio', () => {
    const long = 'X'.repeat(100_000);
    const result = truncateOutput(long, {
      maxOutputLength: 10_000,
      headRatio: 0.6,
      tailRatio: 0.2,
    });
    expect(result.truncated).toBe(true);
    // Head should be longer than tail
    const hintIdx = result.output.indexOf('已截断');
    expect(hintIdx).toBeGreaterThan(5_000); // head ~6000 chars before hint
  });

  // -----------------------------------------------------------------------
  // File read truncation (read_file tool)
  // -----------------------------------------------------------------------
  it('should truncate file output by lines', () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `line ${i + 1}`);
    const output = lines.join('\n');
    const result = truncateOutput(output, {
      maxOutputLength: 5000,
      toolName: 'read_file',
    });
    expect(result.truncated).toBe(true);
    expect(result.hint).toContain('行');
    // Should keep some head lines and tail lines
    expect(result.output).toContain('line 1');
    expect(result.output).toContain('line 2000');
  });

  it('should not truncate short file output', () => {
    const short = 'line 1\nline 2\nline 3';
    const result = truncateOutput(short, {
      maxOutputLength: 5000,
      toolName: 'read_file',
    });
    expect(result.truncated).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Shell output truncation
  // -----------------------------------------------------------------------
  it('should preserve error lines in shell output', () => {
    const stdout = 'a'.repeat(40_000);
    const errorPart = 'Error: something went wrong\n  at Object.<anonymous>';
    const output = stdout + '\n' + errorPart;
    const result = truncateOutput(output, {
      maxOutputLength: 5000,
      toolName: 'shell',
    });
    expect(result.truncated).toBe(true);
    // Error portion should be preserved
    expect(result.output).toContain('Error: something went wrong');
    expect(result.hint).toContain('标准输出已截断');
  });

  it('should fall back to generic truncation when no error keywords', () => {
    const output = 'x'.repeat(60_000);
    const result = truncateOutput(output, {
      maxOutputLength: 5000,
      toolName: 'shell',
    });
    expect(result.truncated).toBe(true);
    expect(result.hint).toContain('已截断');
  });

  it('should not truncate short shell output', () => {
    const short = 'ls -la\nfile1\nfile2';
    const result = truncateOutput(short, {
      maxOutputLength: 5000,
      toolName: 'shell',
    });
    expect(result.truncated).toBe(false);
  });

  // -----------------------------------------------------------------------
  // grep output truncation
  // -----------------------------------------------------------------------
  it('should truncate grep output by matching line count', () => {
    const matches = Array.from(
      { length: 500 },
      (_, i) => `file.ts:${i + 1}:matched content ${i}`,
    );
    const output = matches.join('\n');
    const result = truncateOutput(output, {
      maxOutputLength: 5000,
      toolName: 'grep',
    });
    expect(result.truncated).toBe(true);
    expect(result.hint).toContain('匹配结果未显示');
    expect(result.output).toContain('file.ts:1:');
  });

  it('should not truncate short grep output', () => {
    const short = 'a.ts:1:match1\nb.ts:2:match2';
    const result = truncateOutput(short, {
      maxOutputLength: 5000,
      toolName: 'grep',
    });
    expect(result.truncated).toBe(false);
  });

  // -----------------------------------------------------------------------
  // glob output truncation
  // -----------------------------------------------------------------------
  it('should truncate glob output by file path count', () => {
    const paths = Array.from({ length: 1000 }, (_, i) => `src/dir${i}/file${i}.ts`);
    const output = paths.join('\n');
    const result = truncateOutput(output, {
      maxOutputLength: 5000,
      toolName: 'glob',
    });
    expect(result.truncated).toBe(true);
    expect(result.hint).toContain('文件路径未显示');
    expect(result.output).toContain('src/dir0/file0.ts');
  });

  it('should not truncate short glob output', () => {
    const short = 'src/a.ts\nsrc/b.ts';
    const result = truncateOutput(short, {
      maxOutputLength: 5000,
      toolName: 'glob',
    });
    expect(result.truncated).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Unknown tool falls back to generic
  // -----------------------------------------------------------------------
  it('should fall back to generic truncation for unknown tool names', () => {
    const output = 'z'.repeat(60_000);
    const result = truncateOutput(output, {
      maxOutputLength: 5000,
      toolName: 'some_custom_tool',
    });
    expect(result.truncated).toBe(true);
    expect(result.hint).toContain('已截断');
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it('should handle empty string', () => {
    const result = truncateOutput('');
    expect(result.truncated).toBe(false);
    expect(result.output).toBe('');
  });

  it('should handle output exactly at maxLength', () => {
    const output = 'a'.repeat(5000);
    const result = truncateOutput(output, { maxOutputLength: 5000 });
    expect(result.truncated).toBe(false);
  });

  it('should handle output one char over maxLength', () => {
    const output = 'a'.repeat(5001);
    const result = truncateOutput(output, { maxOutputLength: 5000 });
    expect(result.truncated).toBe(true);
  });
});
