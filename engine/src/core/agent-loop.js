"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentLoop = agentLoop;
const streaming_js_1 = require("../llm/streaming.js");
async function* agentLoop(messages, tools, llmClient, toolRegistry, permissionChecker, options) {
    let turnCount = 0;
    while (turnCount < options.maxTurns) {
        turnCount++;
        const collector = new streaming_js_1.StreamCollector();
        let promptTokens = 0;
        let completionTokens = 0;
        if (options.streaming) {
            const stream = llmClient.chatStream(messages, tools);
            for await (const event of stream) {
                if (event.type === 'content_delta' && event.delta) {
                    options.onToken?.(event.delta);
                }
                if (event.type === 'finish' && event.usage) {
                    promptTokens = event.usage.promptTokens;
                    completionTokens = event.usage.completionTokens;
                }
                collector.feed(event);
            }
        }
        else {
            const response = await llmClient.chat(messages, tools);
            promptTokens = response.usage.promptTokens;
            completionTokens = response.usage.completionTokens;
            if (response.content) {
                collector.feed({ type: 'content_delta', delta: response.content });
            }
            if (response.toolCalls) {
                for (let i = 0; i < response.toolCalls.length; i++) {
                    const tc = response.toolCalls[i];
                    collector.feed({ type: 'tool_call_start', index: i, id: tc.id, name: tc.name });
                    collector.feed({ type: 'tool_call_delta', index: i, argumentsDelta: JSON.stringify(tc.arguments) });
                }
            }
        }
        if (promptTokens > 0 || completionTokens > 0) {
            options.onUsage?.(promptTokens, completionTokens);
        }
        const { content, toolCalls } = collector.getResult();
        if (content) {
            yield { type: 'text', content };
        }
        if (!toolCalls || toolCalls.length === 0) {
            yield { type: 'done' };
            return;
        }
        messages.push({
            role: 'assistant',
            content: content || null,
            tool_calls: toolCalls,
        });
        for (const toolCall of toolCalls) {
            if (permissionChecker) {
                const tool = toolRegistry.get(toolCall.name);
                const riskLevel = tool?.riskLevel || 'execute';
                const permission = await permissionChecker.check({
                    toolName: toolCall.name,
                    args: toolCall.arguments,
                    riskLevel,
                    description: `${toolCall.name}(${JSON.stringify(toolCall.arguments).slice(0, 100)})`,
                });
                if (!permission.allowed) {
                    const errorResult = {
                        output: `Permission denied: ${permission.reason || 'User denied this operation'}`,
                        isError: true,
                    };
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(errorResult),
                    });
                    yield { type: 'tool_result', name: toolCall.name, result: errorResult };
                    continue;
                }
            }
            options.onToolStart?.(toolCall.name, toolCall.arguments);
            const result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
            options.onToolResult?.(toolCall.name, result);
            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
            });
            yield { type: 'tool_result', name: toolCall.name, result };
        }
    }
    yield { type: 'error', message: `Max turns (${options.maxTurns}) exceeded` };
}
//# sourceMappingURL=agent-loop.js.map