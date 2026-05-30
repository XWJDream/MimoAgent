export declare class FileCache {
    private cache;
    private maxEntries;
    constructor(maxEntries?: number);
    get(filePath: string): Promise<string | null>;
    getOrLoad(filePath: string): Promise<string>;
    set(filePath: string, content: string): void;
    invalidate(filePath: string): void;
    clear(): void;
}
