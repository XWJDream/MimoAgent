import type { PermissionMode } from '../config/types.js';
import type { RiskLevel } from '../tools/base.js';
export interface PermissionRequest {
    toolName: string;
    args: Record<string, unknown>;
    riskLevel: RiskLevel;
    description: string;
}
export interface PermissionResult {
    allowed: boolean;
    reason?: string;
}
export declare class PermissionChecker {
    private mode;
    private sessionOverrides;
    constructor(mode: PermissionMode);
    setMode(mode: PermissionMode): void;
    getMode(): PermissionMode;
    check(request: PermissionRequest): Promise<PermissionResult>;
    private promptUser;
}
