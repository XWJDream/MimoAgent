#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { CodexApp } from './tui/codex-app.js';
import { runSingleShot } from './cli/single-shot.js';
import type { MimoConfig, PermissionMode } from './config/types.js';

const program = new Command();

program
  .name('mimo')
  .description('MimoAgent - AI coding agent powered by mimo-v2.5-pro')
  .version('0.1.0')
  .argument('[prompt]', 'Single-shot prompt (omit for interactive mode)')
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --permission-mode <mode>', 'Permission mode: suggest, auto-edit, full-auto')
  .option('--api-base <url>', 'API base URL')
  .option('--api-key <key>', 'API key')
  .option('--no-stream', 'Disable streaming')
  .option('--sandbox', 'Enable sandbox mode')
  .option('-v, --verbose', 'Verbose output')
  .option('--max-turns <n>', 'Maximum agent turns', parseInt)
  .action(async (prompt: string | undefined, options: Record<string, unknown>) => {
    const cliArgs: Partial<MimoConfig> = {};

    if (options.model) cliArgs.model = options.model as string;
    if (options.permissionMode) cliArgs.permissionMode = options.permissionMode as PermissionMode;
    if (options.apiBase) cliArgs.apiBase = options.apiBase as string;
    if (options.apiKey) cliArgs.apiKey = options.apiKey as string;
    if (options.stream === false) cliArgs.stream = false;
    if (options.sandbox) cliArgs.sandbox = { ...((await loadConfig()).sandbox), enabled: true };
    if (options.verbose) cliArgs.verbose = true;
    if (options.maxTurns) cliArgs.maxTurns = options.maxTurns as number;

    const config = await loadConfig(cliArgs);

    if (!config.apiKey) {
      console.error('Error: API key is required. Set MIMO_API_KEY environment variable or use --api-key option.');
      process.exit(1);
    }

    if (prompt) {
      await runSingleShot(prompt, config);
    } else {
      // Interactive Codex-style TUI
      const app = new CodexApp(config);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        app.destroy();
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        app.destroy();
        process.exit(0);
      });

      await app.start();
    }
  });

program.parse();
