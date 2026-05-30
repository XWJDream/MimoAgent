import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

export class ProjectMemory {
  private memoryPath: string;
  private content = '';

  constructor(workingDir: string) {
    this.memoryPath = join(workingDir, '.mimo-agent', 'memory.md');
  }

  async load(): Promise<string> {
    try {
      this.content = await readFile(this.memoryPath, 'utf-8');
    } catch {
      this.content = '';
    }
    return this.content;
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.memoryPath), { recursive: true });
    await writeFile(this.memoryPath, this.content, 'utf-8');
  }

  async append(section: string, content: string): Promise<void> {
    if (!this.content.includes(`## ${section}`)) {
      this.content += `\n\n## ${section}\n${content}`;
    } else {
      this.content = this.content.replace(
        new RegExp(`(## ${section}[\\s\\S]*?)(?=\\n## |$)`),
        `$1${content}\n`,
      );
    }
    await this.save();
  }

  getContent(): string {
    return this.content;
  }

  setContent(content: string): void {
    this.content = content;
  }
}
