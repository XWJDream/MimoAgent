export declare class ProjectMemory {
    private memoryPath;
    private content;
    constructor(workingDir: string);
    load(): Promise<string>;
    save(): Promise<void>;
    append(section: string, content: string): Promise<void>;
    getContent(): string;
    setContent(content: string): void;
}
