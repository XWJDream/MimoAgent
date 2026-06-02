import { describe, it, expect, beforeEach } from 'vitest';
import { ToolCallAssembler, StreamCollector } from './streaming.js';

describe('ToolCallAssembler', () => {
  let assembler: ToolCallAssembler;

  beforeEach(() => {
    assembler = new ToolCallAssembler();
  });

  describe('feed()', () => {
    it('should handle tool_call_start event', () => {
      assembler.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'read_file',
      });

      const result = assembler.getComplete();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('call_123');
      expect(result[0].name).toBe('read_file');
    });

    it('should handle tool_call_delta event', () => {
      assembler.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'read_file',
      });

      assembler.feed({
        type: 'tool_call_delta',
        index: 0,
        argumentsDelta: '{"file',
      });

      assembler.feed({
        type: 'tool_call_delta',
        index: 0,
        argumentsDelta: '_path":"/test.txt"}',
      });

      const result = assembler.getComplete();
      expect(result).toHaveLength(1);
      expect(result[0].arguments).toEqual({ file_path: '/test.txt' });
    });

    it('should handle multiple tool calls', () => {
      assembler.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_1',
        name: 'read_file',
      });

      assembler.feed({
        type: 'tool_call_start',
        index: 1,
        id: 'call_2',
        name: 'write_file',
      });

      assembler.feed({
        type: 'tool_call_delta',
        index: 0,
        argumentsDelta: '{"file_path":"/a.txt"}',
      });

      assembler.feed({
        type: 'tool_call_delta',
        index: 1,
        argumentsDelta: '{"file_path":"/b.txt","content":"hello"}',
      });

      const result = assembler.getComplete();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('read_file');
      expect(result[1].name).toBe('write_file');
    });
  });

  describe('getComplete()', () => {
    it('should return empty array when no calls', () => {
      const result = assembler.getComplete();
      expect(result).toEqual([]);
    });

    it('should handle invalid JSON gracefully', () => {
      assembler.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'test_tool',
      });

      assembler.feed({
        type: 'tool_call_delta',
        index: 0,
        argumentsDelta: 'invalid json',
      });

      const result = assembler.getComplete();
      expect(result).toHaveLength(1);
      expect(result[0].arguments).toEqual({});
    });

    it('should handle empty arguments', () => {
      assembler.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'test_tool',
      });

      const result = assembler.getComplete();
      expect(result).toHaveLength(1);
      expect(result[0].arguments).toEqual({});
    });
  });

  describe('reset()', () => {
    it('should clear all calls', () => {
      assembler.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'read_file',
      });

      assembler.reset();

      const result = assembler.getComplete();
      expect(result).toEqual([]);
    });
  });
});

describe('StreamCollector', () => {
  let collector: StreamCollector;

  beforeEach(() => {
    collector = new StreamCollector();
  });

  describe('feed()', () => {
    it('should collect content deltas', () => {
      collector.feed({ type: 'content_delta', delta: 'Hello' });
      collector.feed({ type: 'content_delta', delta: ' world' });

      const result = collector.getResult();
      expect(result.content).toBe('Hello world');
      expect(result.toolCalls).toBeNull();
    });

    it('should handle empty content delta', () => {
      collector.feed({ type: 'content_delta', delta: '' });
      collector.feed({ type: 'content_delta', delta: 'Hello' });

      const result = collector.getResult();
      expect(result.content).toBe('Hello');
    });

    it('should collect tool calls', () => {
      collector.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'read_file',
      });

      collector.feed({
        type: 'tool_call_delta',
        index: 0,
        argumentsDelta: '{"file_path":"/test.txt"}',
      });

      const result = collector.getResult();
      expect(result.content).toBe('');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('read_file');
    });

    it('should collect both content and tool calls', () => {
      collector.feed({ type: 'content_delta', delta: 'Reading file...' });

      collector.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'read_file',
      });

      collector.feed({
        type: 'tool_call_delta',
        index: 0,
        argumentsDelta: '{"file_path":"/test.txt"}',
      });

      const result = collector.getResult();
      expect(result.content).toBe('Reading file...');
      expect(result.toolCalls).toHaveLength(1);
    });
  });

  describe('getResult()', () => {
    it('should return empty result initially', () => {
      const result = collector.getResult();
      expect(result.content).toBe('');
      expect(result.toolCalls).toBeNull();
    });

    it('should return null for empty tool calls', () => {
      collector.feed({ type: 'content_delta', delta: 'Hello' });

      const result = collector.getResult();
      expect(result.toolCalls).toBeNull();
    });
  });

  describe('reset()', () => {
    it('should clear all state', () => {
      collector.feed({ type: 'content_delta', delta: 'Hello' });

      collector.feed({
        type: 'tool_call_start',
        index: 0,
        id: 'call_123',
        name: 'read_file',
      });

      collector.reset();

      const result = collector.getResult();
      expect(result.content).toBe('');
      expect(result.toolCalls).toBeNull();
    });
  });
});
