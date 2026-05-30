"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionChecker = void 0;
class PermissionChecker {
    mode;
    sessionOverrides = new Map();
    constructor(mode) {
        this.mode = mode;
    }
    setMode(mode) {
        this.mode = mode;
    }
    getMode() {
        return this.mode;
    }
    async check(request) {
        // Check session overrides
        const key = `${request.toolName}:${JSON.stringify(request.args)}`;
        if (this.sessionOverrides.has(key)) {
            return { allowed: this.sessionOverrides.get(key) };
        }
        switch (this.mode) {
            case 'suggest':
                return this.promptUser(request);
            case 'auto-edit':
                if (request.riskLevel === 'read')
                    return { allowed: true };
                if (request.riskLevel === 'write')
                    return { allowed: true };
                return this.promptUser(request);
            case 'full-auto':
                if (request.riskLevel === 'destructive')
                    return this.promptUser(request);
                return { allowed: true };
        }
    }
    async promptUser(request) {
        // In a real implementation, this would use inquirer
        // For now, auto-allow in non-interactive mode
        if (!process.stdin.isTTY) {
            return { allowed: true };
        }
        // Dynamic import to avoid issues in non-interactive environments
        try {
            const { confirm } = await Promise.resolve().then(() => __importStar(require('@inquirer/prompts')));
            const allowed = await confirm({
                message: `Allow ${request.toolName}? ${request.description}`,
                default: false,
            });
            if (allowed) {
                this.sessionOverrides.set(JSON.stringify({ tool: request.toolName, args: request.args }), true);
            }
            return { allowed, reason: allowed ? undefined : 'User denied' };
        }
        catch {
            return { allowed: true };
        }
    }
}
exports.PermissionChecker = PermissionChecker;
//# sourceMappingURL=checker.js.map