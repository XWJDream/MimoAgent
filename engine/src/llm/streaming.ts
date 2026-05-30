import type { ToolCall, StreamEvent } from './types.js';

interface AssembledToolCall {
  id: string;
  name: string;
  argumentsBuffer: string;
}

export class ToolCallAssembler {
  private calls: Map<number, AssembledToolCall> = new Map();

  feed(event: StreamEvent): void {
    if (event.type === 'tool_call_start' && event.index !== undefined) {
      this.calls.set(event.index, {
        id: event.id || '',
        name: event.name || '',
        argumentsBuffer: '',
      });
    }

    if (event.type === 'tool_call_delta' && event.index !== undefined) {
      const existing = this.calls.get(event.index);
      if (existing && event.argumentsDelta) {
        existing.argumentsBuffer += event.argumentsDelta;
      }
    }
  }

  getComplete(): ToolCall[] {
    const result: ToolCall[] = [];
    for (const call of this.calls.values()) {
      try {
        result.push({
          id: call.id,
          name: call.name,
          arguments: JSON.parse(call.argumentsBuffer || '{}'),
        });
      } catch {
        result.push({
          id: call.id,
          name: call.name,
          arguments: {},
        });
      }
    }
    return result;
  }

  reset(): void {
    this.calls.clear();
  }
}

export class StreamCollector {
  private content = '';
  private assembler = new ToolCallAssembler();

  feed(event: StreamEvent): void {
    if (event.type === 'content_delta' && event.delta) {
      this.content += event.delta;
    }
    this.assembler.feed(event);
  }

  getResult(): { content: string; toolCalls: ToolCall[] | null } {
    const toolCalls = this.assembler.getComplete();
    return {
      content: this.content,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
    };
  }

  reset(): void {
    this.content = '';
    this.assembler.reset();
  }
}
