"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectMemory = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
class ProjectMemory {
    memoryPath;
    content = '';
    constructor(workingDir) {
        this.memoryPath = (0, path_1.join)(workingDir, '.mimo-agent', 'memory.md');
    }
    async load() {
        try {
            this.content = await (0, promises_1.readFile)(this.memoryPath, 'utf-8');
        }
        catch {
            this.content = '';
        }
        return this.content;
    }
    async save() {
        await (0, promises_1.mkdir)((0, path_1.dirname)(this.memoryPath), { recursive: true });
        await (0, promises_1.writeFile)(this.memoryPath, this.content, 'utf-8');
    }
    async append(section, content) {
        if (!this.content.includes(`## ${section}`)) {
            this.content += `\n\n## ${section}\n${content}`;
        }
        else {
            this.content = this.content.replace(new RegExp(`(## ${section}[\\s\\S]*?)(?=\\n## |$)`), `$1${content}\n`);
        }
        await this.save();
    }
    getContent() {
        return this.content;
    }
    setContent(content) {
        this.content = content;
    }
}
exports.ProjectMemory = ProjectMemory;
//# sourceMappingURL=memory.js.map