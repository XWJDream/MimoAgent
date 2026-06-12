import fs from 'fs';
import path from 'path';
import type { Plugin, PluginManifest, PluginHooks, PluginContext } from './types.js';

const PLUGIN_DIRS = [
  // Global plugins
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.mimo-agent', 'plugins'),
];

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private pluginDir: string;

  constructor(pluginDir?: string) {
    this.pluginDir = pluginDir || PLUGIN_DIRS[0];
  }

  /**
   * Load all plugins from the plugin directory
   */
  async loadAll(): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    try {
      if (!fs.existsSync(this.pluginDir)) {
        fs.mkdirSync(this.pluginDir, { recursive: true });
        return plugins;
      }

      const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        try {
          const plugin = await this.loadPlugin(entry.name);
          if (plugin) {
            plugins.push(plugin);
            this.plugins.set(plugin.manifest.name, plugin);
          }
        } catch (err) {
          console.error(`[PluginLoader] Failed to load plugin ${entry.name}:`, err);
        }
      }
    } catch (err) {
      console.error('[PluginLoader] Failed to read plugin directory:', err);
    }

    return plugins;
  }

  /**
   * Load a single plugin by name
   */
  async loadPlugin(pluginName: string): Promise<Plugin | null> {
    const pluginPath = path.join(this.pluginDir, pluginName);
    const manifestPath = path.join(pluginPath, 'manifest.json');

    // Read manifest
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[PluginLoader] Plugin ${pluginName}: missing manifest.json`);
      return null;
    }

    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (err) {
      console.error(`[PluginLoader] Plugin ${pluginName}: invalid manifest.json:`, err);
      return null;
    }

    // Validate manifest
    if (!manifest.name || !manifest.main) {
      console.warn(`[PluginLoader] Plugin ${pluginName}: invalid manifest (missing name or main)`);
      return null;
    }

    // Load entry file
    const entryPath = path.join(pluginPath, manifest.main);
    if (!fs.existsSync(entryPath)) {
      console.warn(`[PluginLoader] Plugin ${pluginName}: entry file not found: ${manifest.main}`);
      return null;
    }

    // Dynamic import
    let hooks: PluginHooks = {};
    try {
      const module = await import(entryPath);
      hooks = module.default || module;
    } catch (err) {
      console.error(`[PluginLoader] Plugin ${pluginName}: failed to import entry:`, err);
      return null;
    }

    // Create plugin context
    const context: PluginContext = {
      workingDirectory: pluginPath,
      config: {},
      logger: {
        info: (msg) => console.log(`[Plugin:${manifest.name}] ${msg}`),
        warn: (msg) => console.warn(`[Plugin:${manifest.name}] ${msg}`),
        error: (msg) => console.error(`[Plugin:${manifest.name}] ${msg}`),
      },
    };

    return {
      manifest,
      hooks,
      context,
      enabled: true,
      loadedAt: Date.now(),
    };
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Enable or disable a plugin
   */
  setEnabled(name: string, enabled: boolean): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.enabled = enabled;
    }
  }

  /**
   * Unload a plugin
   */
  unload(name: string): void {
    this.plugins.delete(name);
  }

  /**
   * Get the plugin directory path
   */
  getPluginDir(): string {
    return this.pluginDir;
  }
}
