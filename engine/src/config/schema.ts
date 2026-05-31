import { z } from 'zod';

const PermissionModeSchema = z.enum(['suggest', 'auto-edit', 'full-auto']);

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

export const ConfigSchema = z.object({
  model: z.string().default('mimo-v2.5-pro'),
  apiBase: z.string().url().default('https://api.xiaomimimo.com/v1'),
  apiKey: z.string().default(''),
  maxTokens: z.number().default(4096),
  temperature: z.number().min(0).max(2).default(0.2),
  contextWindow: z.number().default(128000),
  permissionMode: PermissionModeSchema.default('suggest'),
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
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;
