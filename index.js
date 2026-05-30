"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const IPC = {
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
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_CLOSE: 'window:close',
};
const api = {
    // Agent
    agent: {
        run: (prompt) => electron_1.ipcRenderer.invoke(IPC.AGENT_RUN, prompt),
        stop: () => electron_1.ipcRenderer.send(IPC.AGENT_STOP),
        clear: () => electron_1.ipcRenderer.send(IPC.AGENT_CLEAR),
        onToken: (cb) => {
            const handler = (_, token) => cb(token);
            electron_1.ipcRenderer.on(IPC.AGENT_TOKEN, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.AGENT_TOKEN, handler);
        },
        onToolStart: (cb) => {
            const handler = (_, tool) => cb(tool);
            electron_1.ipcRenderer.on(IPC.AGENT_TOOL_START, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.AGENT_TOOL_START, handler);
        },
        onToolResult: (cb) => {
            const handler = (_, result) => cb(result);
            electron_1.ipcRenderer.on(IPC.AGENT_TOOL_RESULT, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.AGENT_TOOL_RESULT, handler);
        },
        onDone: (cb) => {
            const handler = (_, usage) => cb(usage);
            electron_1.ipcRenderer.on(IPC.AGENT_DONE, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.AGENT_DONE, handler);
        },
        onError: (cb) => {
            const handler = (_, error) => cb(error);
            electron_1.ipcRenderer.on(IPC.AGENT_ERROR, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.AGENT_ERROR, handler);
        },
        onThinking: (cb) => {
            const handler = () => cb();
            electron_1.ipcRenderer.on(IPC.AGENT_THINKING, handler);
            return () => electron_1.ipcRenderer.removeListener(IPC.AGENT_THINKING, handler);
        },
    },
    // Config
    config: {
        get: () => electron_1.ipcRenderer.invoke(IPC.CONFIG_GET),
        set: (key, value) => electron_1.ipcRenderer.invoke(IPC.CONFIG_SET, key, value),
    },
    // Sessions
    session: {
        list: () => electron_1.ipcRenderer.invoke(IPC.SESSION_LIST),
        create: (name) => electron_1.ipcRenderer.invoke(IPC.SESSION_CREATE, name),
        switch: (id) => electron_1.ipcRenderer.invoke(IPC.SESSION_SWITCH, id),
        delete: (id) => electron_1.ipcRenderer.invoke(IPC.SESSION_DELETE, id),
        rename: (id, name) => electron_1.ipcRenderer.invoke(IPC.SESSION_RENAME, id, name),
    },
    // Window
    window: {
        minimize: () => electron_1.ipcRenderer.send(IPC.WINDOW_MINIMIZE),
        maximize: () => electron_1.ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
        close: () => electron_1.ipcRenderer.send(IPC.WINDOW_CLOSE),
    },
};
electron_1.contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=index.js.map