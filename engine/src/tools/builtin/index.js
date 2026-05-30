"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskListTool = exports.TaskUpdateTool = exports.TaskCreateTool = exports.ShellTool = exports.GlobTool = exports.GrepTool = exports.EditFileTool = exports.WriteFileTool = exports.ReadFileTool = void 0;
exports.registerBuiltinTools = registerBuiltinTools;
const read_file_js_1 = require("./read-file.js");
const write_file_js_1 = require("./write-file.js");
const edit_file_js_1 = require("./edit-file.js");
const grep_js_1 = require("./grep.js");
const glob_js_1 = require("./glob.js");
const shell_js_1 = require("./shell.js");
const task_js_1 = require("./task.js");
function registerBuiltinTools(registry) {
    registry.registerAll([
        new read_file_js_1.ReadFileTool(),
        new write_file_js_1.WriteFileTool(),
        new edit_file_js_1.EditFileTool(),
        new grep_js_1.GrepTool(),
        new glob_js_1.GlobTool(),
        new shell_js_1.ShellTool(),
        new task_js_1.TaskCreateTool(),
        new task_js_1.TaskUpdateTool(),
        new task_js_1.TaskListTool(),
    ]);
}
var read_file_js_2 = require("./read-file.js");
Object.defineProperty(exports, "ReadFileTool", { enumerable: true, get: function () { return read_file_js_2.ReadFileTool; } });
var write_file_js_2 = require("./write-file.js");
Object.defineProperty(exports, "WriteFileTool", { enumerable: true, get: function () { return write_file_js_2.WriteFileTool; } });
var edit_file_js_2 = require("./edit-file.js");
Object.defineProperty(exports, "EditFileTool", { enumerable: true, get: function () { return edit_file_js_2.EditFileTool; } });
var grep_js_2 = require("./grep.js");
Object.defineProperty(exports, "GrepTool", { enumerable: true, get: function () { return grep_js_2.GrepTool; } });
var glob_js_2 = require("./glob.js");
Object.defineProperty(exports, "GlobTool", { enumerable: true, get: function () { return glob_js_2.GlobTool; } });
var shell_js_2 = require("./shell.js");
Object.defineProperty(exports, "ShellTool", { enumerable: true, get: function () { return shell_js_2.ShellTool; } });
var task_js_2 = require("./task.js");
Object.defineProperty(exports, "TaskCreateTool", { enumerable: true, get: function () { return task_js_2.TaskCreateTool; } });
Object.defineProperty(exports, "TaskUpdateTool", { enumerable: true, get: function () { return task_js_2.TaskUpdateTool; } });
Object.defineProperty(exports, "TaskListTool", { enumerable: true, get: function () { return task_js_2.TaskListTool; } });
//# sourceMappingURL=index.js.map