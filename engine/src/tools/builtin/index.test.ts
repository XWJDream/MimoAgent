import { describe, expect, it } from 'vitest';
import { getDefaultConfig } from '../../config/defaults.js';
import { ToolRegistry } from '../registry.js';
import { registerBuiltinTools } from './index.js';

describe('registerBuiltinTools', () => {
  it('registers sub_agents_run only for act mode with sub-agents enabled', () => {
    const enabled = new ToolRegistry();
    registerBuiltinTools(enabled, 'act', {
      mimoConfig: { ...getDefaultConfig(), subAgents: { enabled: true, maxConcurrent: 3 } },
      subAgents: { enabled: true, maxConcurrent: 3 },
    });

    const plan = new ToolRegistry();
    registerBuiltinTools(plan, 'plan', {
      mimoConfig: { ...getDefaultConfig(), subAgents: { enabled: true, maxConcurrent: 3 } },
      subAgents: { enabled: true, maxConcurrent: 3 },
    });

    const disabled = new ToolRegistry();
    registerBuiltinTools(disabled, 'act', {
      mimoConfig: { ...getDefaultConfig(), subAgents: { enabled: false, maxConcurrent: 3 } },
      subAgents: { enabled: false, maxConcurrent: 3 },
    });

    expect(enabled.getNames()).toContain('sub_agents_run');
    expect(plan.getNames()).not.toContain('sub_agents_run');
    expect(disabled.getNames()).not.toContain('sub_agents_run');
  });
});
