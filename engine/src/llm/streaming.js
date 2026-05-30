"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamCollector = exports.ToolCallAssembler = void 0;
class ToolCallAssembler {
    calls = new Map();
    feed(event) {
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
    getComplete() {
        const result = [];
        for (const call of this.calls.values()) {
            try {
                result.push({
                    id: call.id,
                    name: call.name,
                    arguments: JSON.parse(call.argumentsBuffer || '{}'),
                });
            }
            catch {
                result.push({
                    id: call.id,
                    name: call.name,
                    arguments: {},
                });
            }
        }
        return result;
    }
    reset() {
        this.calls.clear();
    }
}
exports.ToolCallAssembler = ToolCallAssembler;
class StreamCollector {
    content = '';
    assembler = new ToolCallAssembler();
    feed(event) {
        if (event.type === 'content_delta' && event.delta) {
            this.content += event.delta;
        }
        this.assembler.feed(event);
    }
    getResult() {
        const toolCalls = this.assembler.getComplete();
        return {
            content: this.content,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
        };
    }
    reset() {
        this.content = '';
        this.assembler.reset();
    }
}
exports.StreamCollector = StreamCollector;
//# sourceMappingURL=streaming.js.map