export interface UsageRecord {
    timestamp: number;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
    turnCount: number;
    toolCalls: number;
}
export interface UsageStats {
    totalRecords: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    totalEstimatedCost: number;
    totalTurns: number;
    totalToolCalls: number;
    sessionRecords: number;
    sessionPromptTokens: number;
    sessionCompletionTokens: number;
    sessionTokens: number;
    sessionEstimatedCost: number;
    sessionTurns: number;
    sessionToolCalls: number;
    byModel: Record<string, {
        tokens: number;
        cost: number;
        calls: number;
    }>;
    recentRecords: UsageRecord[];
}
export declare class UsageTracker {
    private records;
    private sessionRecords;
    private persistencePath;
    private pricing;
    private currentTurnCount;
    private currentToolCalls;
    constructor(options?: {
        persistencePath?: string;
        pricing?: Record<string, {
            input: number;
            output: number;
        }>;
    });
    load(): Promise<void>;
    save(): Promise<void>;
    recordUsage(model: string, promptTokens: number, completionTokens: number): UsageRecord;
    incrementTurn(): void;
    incrementToolCall(): void;
    getStats(): UsageStats;
    getSessionSummary(): string;
    formatStats(): string;
}
