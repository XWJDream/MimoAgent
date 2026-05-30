import type { ToolCall, StreamEvent } from './types.js';
export declare class ToolCallAssembler {
    private calls;
    feed(event: StreamEvent): void;
    getComplete(): ToolCall[];
    reset(): void;
}
export declare class StreamCollector {
    private content;
    private assembler;
    feed(event: StreamEvent): void;
    getResult(): {
        content: string;
        toolCalls: ToolCall[] | null;
    };
    reset(): void;
}
