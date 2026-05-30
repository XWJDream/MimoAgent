"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShellTool = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const base_js_1 = require("../base.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ShellTool extends base_js_1.BaseTool {
    name = 'shell';
    description = 'Execute a shell command and return its output. Use with caution.';
    riskLevel = 'execute';
    categories = ['shell'];
    parameters = {
        type: 'function',
        function: {
            name: 'shell',
            description: 'Execute a shell command and return stdout/stderr.',
            parameters: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'The shell command to execute' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
                },
                required: ['command'],
            },
        },
    };
    async execute(args, context) {
        const { command, timeout } = args;
        // Safety: block obviously destructive commands
        const dangerous = ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'];
        for (const pattern of dangerous) {
            if (command.includes(pattern)) {
                return { output: `Error: Blocked dangerous command: ${command}`, isError: true };
            }
        }
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: context.workingDirectory,
                timeout: timeout || 30000,
                maxBuffer: 5 * 1024 * 1024,
                shell: process.env.SHELL || (process.platform === 'win32' ? 'powershell' : 'bash'),
            });
            const output = [stdout, stderr].filter(Boolean).join('\n');
            return {
                output: output || '(no output)',
                isError: false,
            };
        }
        catch (error) {
            const err = error;
            return {
                output: [
                    err.stdout && `stdout: ${err.stdout}`,
                    err.stderr && `stderr: ${err.stderr}`,
                    `Error: ${err.message || String(error)}`,
                ]
                    .filter(Boolean)
                    .join('\n'),
                isError: true,
            };
        }
    }
}
exports.ShellTool = ShellTool;
//# sourceMappingURL=shell.js.map