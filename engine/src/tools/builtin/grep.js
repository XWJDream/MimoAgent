"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrepTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const base_js_1 = require("../base.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GrepTool extends base_js_1.BaseTool {
    name = 'grep';
    description = 'Search for a pattern in files using ripgrep. Returns matching lines with file paths and line numbers.';
    riskLevel = 'read';
    categories = ['search'];
    parameters = {
        type: 'function',
        function: {
            name: 'grep',
            description: 'Search for a pattern in files using ripgrep.',
            parameters: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'The regex pattern to search for' },
                    path: { type: 'string', description: 'Directory or file to search in (defaults to working directory)' },
                    glob: { type: 'string', description: 'File glob pattern to filter (e.g., "*.ts")' },
                    case_insensitive: { type: 'boolean', description: 'Case insensitive search' },
                },
                required: ['pattern'],
            },
        },
    };
    async execute(args, context) {
        const { pattern, path, glob, case_insensitive } = args;
        const searchPath = path || context.workingDirectory;
        const flags = ['--no-heading', '--line-number'];
        if (case_insensitive)
            flags.push('--ignore-case');
        if (glob)
            flags.push('--glob', glob);
        // Limit output to prevent overwhelming
        flags.push('--max-count', '100');
        const cmd = `rg ${flags.map((f) => `'${f}'`).join(' ')} '${pattern.replace(/'/g, "'\\''")}' '${searchPath}'`;
        try {
            const { stdout, stderr } = await execAsync(cmd, {
                cwd: context.workingDirectory,
                timeout: 10000,
                maxBuffer: 1024 * 1024,
            });
            if (stderr && !stdout) {
                return { output: `grep: ${stderr}`, isError: true };
            }
            return {
                output: stdout || 'No matches found.',
                isError: false,
            };
        }
        catch (error) {
            const err = error;
            if (err.code === 1) {
                return { output: 'No matches found.', isError: false };
            }
            return {
                output: `grep error: ${err.message || String(error)}`,
                isError: true,
            };
        }
    }
}
exports.GrepTool = GrepTool;
//# sourceMappingURL=grep.js.map