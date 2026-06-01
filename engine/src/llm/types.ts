export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

export interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[] | null;
  usage: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface StreamEvent {
  type: 'content_delta' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'finish';
  delta?: string;
  index?: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
  reason?: string;
  usage?: TokenUsage;
}
