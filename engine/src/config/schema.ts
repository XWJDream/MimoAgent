import { z } from 'zod';

const PermissionModeSchema = z.enum(['suggest', 'auto-edit', 'full-auto']);

const AgentModeSchema = z.enum(['build', 'plan', 'explore']);

const SandboxConfigSchema = z.object({
  enabled: z.boolean().default(false),
  image: z.string().default('mimo-agent-sandbox:latest'),
  memoryLimit: z.string().default('512m'),
  cpuLimit: z.number().default(1024),
  networkEnabled: z.boolean().default(false),
  timeout: z.number().default(30000),
});

const SubAgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxConcurrent: z.number().default(3),
});

const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextWindow: z.number(),
  maxOutputTokens: z.number(),
  supportsTools: z.boolean(),
  supportsStreaming: z.boolean(),
  costPer1kInput: z.number().optional(),
  costPer1kOutput: z.number().optional(),
});

const ProviderConfigSchema = z.object({
  name: z.string().optional(),
  models: z.array(ModelInfoSchema).optional(),
  defaultModel: z.string().optional(),
});

const ProviderEntrySchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  models: z.array(ModelInfoSchema).optional(),
});

export const ConfigSchema = z.object({
  model: z.string().default('mimo-v2.5-pro'),
  apiBase: z.string().url().default('https://api.xiaomimimo.com/v1'),
  apiKey: z.string().default(''),
  maxTokens: z.number().default(4096),
  temperature: z.number().min(0).max(2).default(0.2),
  contextWindow: z.number().default(128000),
  permissionMode: PermissionModeSchema.default('suggest'),
  agentMode: AgentModeSchema.default('build'),
  allowedTools: z.array(z.string()).default([]),
  blockedTools: z.array(z.string()).default([]),
  allowedPaths: z.array(z.string()).default(['.']),
  maxTurns: z.number().default(50),
  systemPromptAppend: z.string().optional(),
  disableDefaultTools: z.array(z.string()).default([]),
  sandbox: SandboxConfigSchema.default({}),
  theme: z.enum(['dark', 'light']).default('dark'),
  stream: z.boolean().default(true),
  verbose: z.boolean().default(false),
  subAgents: SubAgentConfigSchema.default({}),
  provider: ProviderConfigSchema.optional(),
  providers: z.record(ProviderEntrySchema).optional(),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;
