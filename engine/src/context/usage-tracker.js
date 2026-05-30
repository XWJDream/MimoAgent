"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageTracker = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const os_1 = require("os");
// Pricing per 1M tokens (approximate, configurable)
const DEFAULT_PRICING = {
    'mimo-v2.5-pro': { input: 2.0, output: 8.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
    default: { input: 2.0, output: 8.0 },
};
class UsageTracker {
    records = [];
    sessionRecords = [];
    persistencePath;
    pricing;
    currentTurnCount = 0;
    currentToolCalls = 0;
    constructor(options) {
        this.persistencePath = options?.persistencePath || (0, path_1.join)((0, os_1.homedir)(), '.mimo-agent', 'usage.json');
        this.pricing = { ...DEFAULT_PRICING, ...options?.pricing };
    }
    async load() {
        try {
            const data = await (0, promises_1.readFile)(this.persistencePath, 'utf-8');
            this.records = JSON.parse(data);
        }
        catch {
            this.records = [];
        }
    }
    async save() {
        try {
            await (0, promises_1.mkdir)((0, path_1.dirname)(this.persistencePath), { recursive: true });
            await (0, promises_1.writeFile)(this.persistencePath, JSON.stringify(this.records, null, 2), 'utf-8');
        }
        catch {
            // Silently fail if can't persist
        }
    }
    recordUsage(model, promptTokens, completionTokens) {
        const pricing = this.pricing[model] || this.pricing.default;
        const cost = (promptTokens / 1_000_000) * pricing.input +
            (completionTokens / 1_000_000) * pricing.output;
        const record = {
            timestamp: Date.now(),
            model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedCost: cost,
            turnCount: this.currentTurnCount,
            toolCalls: this.currentToolCalls,
        };
        this.records.push(record);
        this.sessionRecords.push(record);
        // Reset per-turn counters
        this.currentTurnCount = 0;
        this.currentToolCalls = 0;
        // Auto-save periodically
        if (this.sessionRecords.length % 10 === 0) {
            this.save();
        }
        return record;
    }
    incrementTurn() {
        this.currentTurnCount++;
    }
    incrementToolCall() {
        this.currentToolCalls++;
    }
    getStats() {
        const aggregate = (records) => records.reduce((acc, r) => ({
            promptTokens: acc.promptTokens + r.promptTokens,
            completionTokens: acc.completionTokens + r.completionTokens,
            totalTokens: acc.totalTokens + r.totalTokens,
            cost: acc.cost + r.estimatedCost,
            turns: acc.turns + r.turnCount,
            toolCalls: acc.toolCalls + r.toolCalls,
        }), { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, turns: 0, toolCalls: 0 });
        const total = aggregate(this.records);
        const session = aggregate(this.sessionRecords);
        // Group by model
        const byModel = {};
        for (const r of this.records) {
            if (!byModel[r.model]) {
                byModel[r.model] = { tokens: 0, cost: 0, calls: 0 };
            }
            byModel[r.model].tokens += r.totalTokens;
            byModel[r.model].cost += r.estimatedCost;
            byModel[r.model].calls += r.toolCalls;
        }
        return {
            totalRecords: this.records.length,
            totalPromptTokens: total.promptTokens,
            totalCompletionTokens: total.completionTokens,
            totalTokens: total.totalTokens,
            totalEstimatedCost: total.cost,
            totalTurns: total.turns,
            totalToolCalls: total.toolCalls,
            sessionRecords: this.sessionRecords.length,
            sessionPromptTokens: session.promptTokens,
            sessionCompletionTokens: session.completionTokens,
            sessionTokens: session.totalTokens,
            sessionEstimatedCost: session.cost,
            sessionTurns: session.turns,
            sessionToolCalls: session.toolCalls,
            byModel,
            recentRecords: this.records.slice(-10),
        };
    }
    getSessionSummary() {
        const stats = this.getStats();
        return `Session: ${stats.sessionRecords} calls | ${stats.sessionTokens.toLocaleString()} tokens | $${stats.sessionEstimatedCost.toFixed(4)}`;
    }
    formatStats() {
        const stats = this.getStats();
        const lines = [];
        lines.push('');
        lines.push('=== Usage Statistics ===');
        lines.push('');
        lines.push('--- Current Session ---');
        lines.push(`  API Calls:      ${stats.sessionRecords}`);
        lines.push(`  Prompt Tokens:  ${stats.sessionPromptTokens.toLocaleString()}`);
        lines.push(`  Output Tokens:  ${stats.sessionCompletionTokens.toLocaleString()}`);
        lines.push(`  Total Tokens:   ${stats.sessionTokens.toLocaleString()}`);
        lines.push(`  Tool Calls:     ${stats.sessionToolCalls}`);
        lines.push(`  Est. Cost:      $${stats.sessionEstimatedCost.toFixed(4)}`);
        lines.push('');
        lines.push('--- All Time ---');
        lines.push(`  API Calls:      ${stats.totalRecords}`);
        lines.push(`  Prompt Tokens:  ${stats.totalPromptTokens.toLocaleString()}`);
        lines.push(`  Output Tokens:  ${stats.totalCompletionTokens.toLocaleString()}`);
        lines.push(`  Total Tokens:   ${stats.totalTokens.toLocaleString()}`);
        lines.push(`  Tool Calls:     ${stats.totalToolCalls}`);
        lines.push(`  Est. Cost:      $${stats.totalEstimatedCost.toFixed(4)}`);
        if (Object.keys(stats.byModel).length > 0) {
            lines.push('');
            lines.push('--- By Model ---');
            for (const [model, data] of Object.entries(stats.byModel)) {
                lines.push(`  ${model}:`);
                lines.push(`    Tokens: ${data.tokens.toLocaleString()} | Cost: $${data.cost.toFixed(4)} | Tool Calls: ${data.calls}`);
            }
        }
        if (stats.recentRecords.length > 0) {
            lines.push('');
            lines.push('--- Recent Calls (last 10) ---');
            for (const r of stats.recentRecords) {
                const time = new Date(r.timestamp).toLocaleTimeString();
                lines.push(`  ${time} | ${r.model} | in:${r.promptTokens} out:${r.completionTokens} | $${r.estimatedCost.toFixed(6)}`);
            }
        }
        lines.push('');
        return lines.join('\n');
    }
}
exports.UsageTracker = UsageTracker;
//# sourceMappingURL=usage-tracker.js.map