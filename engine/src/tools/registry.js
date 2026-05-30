"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
class ToolRegistry {
    tools = new Map();
    context = null;
    setContext(context) {
        this.context = context;
    }
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    registerAll(tools) {
        for (const tool of tools) {
            this.register(tool);
        }
    }
    get(name) {
        return this.tools.get(name);
    }
    getDefinitions(categories) {
        const defs = [];
        for (const tool of this.tools.values()) {
            if (!categories || tool.categories.some((c) => categories.includes(c))) {
                defs.push(tool.parameters);
            }
        }
        return defs;
    }
    getNames() {
        return Array.from(this.tools.keys());
    }
    async execute(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                output: `Unknown tool: ${name}`,
                isError: true,
            };
        }
        if (!this.context) {
            return {
                output: 'Tool context not initialized',
                isError: true,
            };
        }
        try {
            return await tool.execute(args, this.context);
        }
        catch (error) {
            return {
                output: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
                isError: true,
            };
        }
    }
    getSubset(categories, specificTools) {
        const defs = this.getDefinitions(categories);
        if (specificTools) {
            return defs.filter((d) => specificTools.includes(d.function.name));
        }
        return defs;
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=registry.js.map