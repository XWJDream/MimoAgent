"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditFileTool = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const base_js_1 = require("../base.js");
class EditFileTool extends base_js_1.BaseTool {
    name = 'edit_file';
    description = 'Edit a file by replacing old_string with new_string. The old_string must be unique in the file.';
    riskLevel = 'write';
    categories = ['file'];
    parameters = {
        type: 'function',
        function: {
            name: 'edit_file',
            description: 'Edit a file by replacing old_string with new_string. The old_string must be unique in the file.',
            parameters: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'Absolute path to the file' },
                    old_string: { type: 'string', description: 'The exact string to find and replace' },
                    new_string: { type: 'string', description: 'The string to replace old_string with' },
                },
                required: ['file_path', 'old_string', 'new_string'],
            },
        },
    };
    async execute(args, context) {
        const { file_path, old_string, new_string } = args;
        const resolved = (0, path_1.resolve)(file_path);
        const rel = (0, path_1.relative)(context.workingDirectory, resolved);
        if (rel.startsWith('..')) {
            return { output: 'Error: Path is outside working directory', isError: true };
        }
        if (old_string === new_string) {
            return { output: 'Error: old_string and new_string are identical', isError: true };
        }
        try {
            let content = await (0, promises_1.readFile)(resolved, 'utf-8');
            const count = content.split(old_string).length - 1;
            if (count === 0) {
                return { output: 'Error: old_string not found in file', isError: true };
            }
            if (count > 1) {
                return {
                    output: `Error: old_string found ${count} times. It must be unique. Provide more context to make it unique.`,
                    isError: true,
                };
            }
            content = content.replace(old_string, new_string);
            await (0, promises_1.writeFile)(resolved, content, 'utf-8');
            context.fileCache.invalidate(resolved);
            return {
                output: `File edited successfully: ${resolved}`,
                isError: false,
            };
        }
        catch (error) {
            return {
                output: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
                isError: true,
            };
        }
    }
}
exports.EditFileTool = EditFileTool;
//# sourceMappingURL=edit-file.js.map