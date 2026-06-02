import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectMemory } from './memory.js';
import { readFile, writeFile, mkdir } from 'fs/promises';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('ProjectMemory', () => {
  let memory: ProjectMemory;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new ProjectMemory('/test/project');
  });

  describe('load()', () => {
    it('should load existing memory file', async () => {
      const content = '# Project Memory\n\n## Notes\nSome notes here';
      vi.mocked(readFile).mockResolvedValue(content);

      const result = await memory.load();

      expect(result).toBe(content);
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('memory.md'),
        'utf-8',
      );
    });

    it('should return empty string if file not found', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await memory.load();

      expect(result).toBe('');
    });

    it('should return empty string for other errors', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('Permission denied'));

      const result = await memory.load();

      expect(result).toBe('');
    });
  });

  describe('save()', () => {
    it('should save memory to file', async () => {
      memory.setContent('# New Content');

      await memory.save();

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.mimo-agent'),
        { recursive: true },
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('memory.md'),
        '# New Content',
        'utf-8',
      );
    });

    it('should create directory if not exists', async () => {
      await memory.save();

      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.mimo-agent'),
        { recursive: true },
      );
    });
  });

  describe('getContent()', () => {
    it('should return empty string initially', () => {
      expect(memory.getContent()).toBe('');
    });

    it('should return loaded content', async () => {
      vi.mocked(readFile).mockResolvedValue('loaded content');

      await memory.load();

      expect(memory.getContent()).toBe('loaded content');
    });
  });

  describe('setContent()', () => {
    it('should set content', () => {
      memory.setContent('new content');

      expect(memory.getContent()).toBe('new content');
    });

    it('should overwrite existing content', async () => {
      vi.mocked(readFile).mockResolvedValue('old content');
      await memory.load();

      memory.setContent('new content');

      expect(memory.getContent()).toBe('new content');
    });
  });

  describe('append()', () => {
    it('should add new section', async () => {
      memory.setContent('# Project Memory');

      await memory.append('Notes', 'Important note here');

      expect(memory.getContent()).toContain('## Notes');
      expect(memory.getContent()).toContain('Important note here');
    });

    it('should append to existing section', async () => {
      memory.setContent('# Project Memory\n\n## Notes\nExisting note');

      await memory.append('Notes', '\nNew note');

      expect(memory.getContent()).toContain('Existing note');
      expect(memory.getContent()).toContain('New note');
    });

    it('should save after appending', async () => {
      memory.setContent('# Project Memory');

      await memory.append('Notes', 'Some note');

      expect(writeFile).toHaveBeenCalled();
    });

    it('should not duplicate section header', async () => {
      memory.setContent('# Project Memory');

      await memory.append('Notes', 'First note');
      await memory.append('Notes', 'Second note');

      const content = memory.getContent();
      const matches = content.match(/## Notes/g);
      expect(matches).toHaveLength(1);
    });
  });

  describe('constructor', () => {
    it('should set correct memory path', () => {
      const mem = new ProjectMemory('/my/project');
      const path = (mem as any).memoryPath;

      expect(path).toContain('.mimo-agent');
      expect(path).toContain('memory.md');
      expect(path).toContain('my');
      expect(path).toContain('project');
    });

    it('should handle Windows paths', () => {
      const mem = new ProjectMemory('C:\\Users\\test\\project');
      const path = (mem as any).memoryPath;

      expect(path).toContain('.mimo-agent');
      expect(path).toContain('memory.md');
    });
  });
});
