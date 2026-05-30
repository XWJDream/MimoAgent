import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { MimoConfig } from './types.js';
import { getDefaultConfig } from './defaults.js';

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

async function loadJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    await access(path);
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function loadEnvConfig(): Partial<MimoConfig> {
  const env: Record<string, unknown> = {};
  if (process.env.MIMO_MODEL) env.model = process.env.MIMO_MODEL;
  if (process.env.MIMO_API_BASE) env.apiBase = process.env.MIMO_API_BASE;
  if (process.env.MIMO_API_KEY) env.apiKey = process.env.MIMO_API_KEY;
  if (process.env.MIMO_PERMISSION_MODE) env.permissionMode = process.env.MIMO_PERMISSION_MODE;
  if (process.env.MIMO_MAX_TURNS) env.maxTurns = parseInt(process.env.MIMO_MAX_TURNS, 10);
  return env as Partial<MimoConfig>;
}

export async function loadConfig(cliArgs: Partial<MimoConfig> = {}): Promise<MimoConfig> {
  const defaults = getDefaultConfig();
  const globalPath = join(homedir(), '.mimo-agent', 'config.json');
  const projectPath = join(process.cwd(), '.mimo-agent', 'config.json');

  const [globalConfig, projectConfig] = await Promise.all([
    loadJsonFile(globalPath),
    loadJsonFile(projectPath),
  ]);

  const envConfig = loadEnvConfig();

  const merged = deepMerge(
    deepMerge(
      deepMerge(
        deepMerge(defaults as unknown as Record<string, unknown>, globalConfig),
        projectConfig,
      ),
      envConfig as unknown as Record<string, unknown>,
    ),
    cliArgs as unknown as Record<string, unknown>,
  );

  return merged as unknown as MimoConfig;
}
