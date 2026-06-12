import type { Plugin, PluginHooks, PluginInfo } from './types.js';
import type { ToolDefinition } from '../tools/schema.js';
import type { ToolResult } from '../tools/base.js';
import { PluginLoader } from './loader.js';

export class PluginRegistry {
  private loader: PluginLoader;
  private plugins: Map<string, Plugin> = new Map();

  constructor(pluginDir?: string) {
    this.loader = new PluginLoader(pluginDir);
  }

  /**
   * Initialize: load all plugins
   */
  async initialize(): Promise<void> {
    const plugins = await this.loader.loadAll();
    for (const plugin of plugins) {
      this.plugins.set(plugin.manifest.name, plugin);
    }
    console.log(`[PluginRegistry] Loaded ${plugins.length} plugins`);
  }

  /**
   * Get all enabled plugins
   */
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Call a specific hook on all enabled plugins
   */
  async callHook<K extends keyof PluginHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): Promise<void> {
    for (const plugin of this.getEnabledPlugins()) {
      const hook = plugin.hooks[hookName];
      if (hook) {
        try {
          await (hook as Function)(...args);
        } catch (err) {
          console.error(`[PluginRegistry] Plugin ${plugin.manifest.name} hook ${String(hookName)} failed:`, err);
        }
      }
    }
  }

  /**
   * Call tool definition hook (chain modification)
   */
  async callToolDefinitionHook(tool: ToolDefinition): Promise<ToolDefinition> {
    let modifiedTool = tool;
    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onToolDefinition) {
        try {
          modifiedTool = await plugin.hooks.onToolDefinition(modifiedTool);
        } catch (err) {
          console.error(`[PluginRegistry] Plugin ${plugin.manifest.name} onToolDefinition failed:`, err);
        }
      }
    }
    return modifiedTool;
  }

  /**
   * Call before-tool hooks (chain processing)
   */
  async callBeforeToolHooks(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ skip: boolean; args: Record<string, unknown> }> {
    let skip = false;
    let modifiedArgs = args;

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onBeforeTool) {
        try {
          const result = await plugin.hooks.onBeforeTool(name, modifiedArgs);
          if (result) {
            if (result.skip) skip = true;
            if (result.modifiedArgs) modifiedArgs = result.modifiedArgs;
          }
        } catch (err) {
          console.error(`[PluginRegistry] Plugin ${plugin.manifest.name} onBeforeTool failed:`, err);
        }
      }
    }

    return { skip, args: modifiedArgs };
  }

  /**
   * Call after-tool hooks (chain processing)
   */
  async callAfterToolHooks(
    name: string,
    result: ToolResult
  ): Promise<ToolResult> {
    let modifiedResult = result;

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onAfterTool) {
        try {
          const hookResult = await plugin.hooks.onAfterTool(name, modifiedResult);
          if (hookResult?.modifiedResult) {
            modifiedResult = hookResult.modifiedResult;
          }
        } catch (err) {
          console.error(`[PluginRegistry] Plugin ${plugin.manifest.name} onAfterTool failed:`, err);
        }
      }
    }

    return modifiedResult;
  }

  /**
   * Collect shell environment variables from all plugins
   */
  async collectShellEnv(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};

    for (const plugin of this.getEnabledPlugins()) {
      if (plugin.hooks.onShellEnv) {
        try {
          const pluginEnv = await plugin.hooks.onShellEnv();
          Object.assign(env, pluginEnv);
        } catch (err) {
          console.error(`[PluginRegistry] Plugin ${plugin.manifest.name} onShellEnv failed:`, err);
        }
      }
    }

    return env;
  }

  /**
   * Get plugin list for IPC (serializable)
   */
  listPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description,
      author: p.manifest.author,
      enabled: p.enabled,
      loadedAt: p.loadedAt,
      hooks: Object.keys(p.hooks).filter(k => typeof p.hooks[k as keyof PluginHooks] === 'function'),
    }));
  }

  /**
   * Enable or disable a plugin
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Reload all plugins
   */
  async reload(): Promise<void> {
    this.plugins.clear();
    await this.initialize();
  }

  /**
   * Get plugin directory path
   */
  getPluginDir(): string {
    return this.loader.getPluginDir();
  }
}
