"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC = void 0;
exports.IPC = {
    AGENT_RUN: 'agent:run',
    AGENT_STOP: 'agent:stop',
    AGENT_CLEAR: 'agent:clear',
    AGENT_TOKEN: 'agent:token',
    AGENT_TOOL_START: 'agent:tool-start',
    AGENT_TOOL_RESULT: 'agent:tool-result',
    AGENT_DONE: 'agent:done',
    AGENT_ERROR: 'agent:error',
    AGENT_THINKING: 'agent:thinking',
    CONFIG_GET: 'config:get',
    CONFIG_SET: 'config:set',
    SESSION_LIST: 'session:list',
    SESSION_CREATE: 'session:create',
    SESSION_SWITCH: 'session:switch',
    SESSION_DELETE: 'session:delete',
    SESSION_RENAME: 'session:rename',
    FILE_READ: 'file:read',
    FILE_WRITE: 'file:write',
    FILE_DIALOG: 'file:dialog',
    SHELL_EXEC: 'shell:exec',
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_CLOSE: 'window:close',
};
//# sourceMappingURL=ipc-channels.js.map