"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteFileTool = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const base_js_1 = require("../base.js");
class WriteFileTool extends base_js_1.BaseTool {
    name = 'write_file';
    description = 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does. Creates parent directories as needed.';
    riskLevel = 'write';
    categories = ['file'];
    parameters = {
        type: 'function',
        function: {
            name: 'write_file',
            description: 'Write content to a file, creating it if it doesn\'t exist.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'Absolute path to the file' },
                    content: { type: 'string', description: 'Content to write to the file' },
                },
                required: ['file_path', 'content'],
            },
        },
    };
    async execute(args, context) {
        const { file_path, content } = args;
        const resolved = (0, path_1.resolve)(file_path);
        const rel = (0, path_1.relative)(context.workingDirectory, resolved);
        if (rel.startsWith('..')) {
            return { output: 'Error: Path is outside working directory', isError: true };
        }
        try {
            await (0, promises_1.mkdir)((0, path_1.dirname)(resolved), { recursive: true });
            await (0, promises_1.writeFile)(resolved, content, 'utf-8');
            context.fileCache.invalidate(resolved);
            const lines = content.split('\n').length;
            return {
                output: `File written successfully: ${resolved} (${lines} lines)`,
                isError: false,
            };
        }
        catch (error) {
            return {
                output: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
                isError: true,
            };
        }
    }
}
exports.WriteFileTool = WriteFileTool;
//# sourceMappingURL=write-file.js.map