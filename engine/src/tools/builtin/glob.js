"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const base_js_1 = require("../base.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GlobTool extends base_js_1.BaseTool {
    name = 'glob';
    description = 'Find files matching a glob pattern. Returns sorted file paths.';
    riskLevel = 'read';
    categories = ['search'];
    parameters = {
        type: 'function',
        function: {
            name: 'glob',
            description: 'Find files matching a glob pattern.',
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.test.js")' },
                    path: { type: 'string', description: 'Directory to search in (defaults to working directory)' },
                },
                required: ['pattern'],
            },
        },
    };
    async execute(args, context) {
        const { pattern, path } = args;
        const searchPath = path || context.workingDirectory;
        try {
            // Use find command as a portable alternative
            const cmd = `find '${searchPath}' -type f -name '${pattern.replace(/'/g, "'\\''")}' | head -200`;
            const { stdout } = await execAsync(cmd, {
                cwd: context.workingDirectory,
                timeout: 10000,
                maxBuffer: 1024 * 1024,
            });
            const files = stdout.trim().split('\n').filter(Boolean);
            if (files.length === 0) {
                return { output: 'No files found matching the pattern.', isError: false };
            }
            return {
                output: files.join('\n'),
                isError: false,
                metadata: { count: files.length },
            };
        }
        catch (error) {
            return {
                output: `glob error: ${error instanceof Error ? error.message : String(error)}`,
                isError: true,
            };
        }
    }
}
exports.GlobTool = GlobTool;
//# sourceMappingURL=glob.js.map