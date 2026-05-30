import {
  SubAgent,
  CoderSubAgent,
  ReviewerSubAgent,
  TesterSubAgent,
  DocGenSubAgent,
  ArchitectSubAgent,
} from '../core/sub-agent.js';

const subAgentRegistry: Map<string, SubAgent> = new Map();

export function registerDefaultSubAgents(): void {
  subAgentRegistry.set('coder', new CoderSubAgent());
  subAgentRegistry.set('reviewer', new ReviewerSubAgent());
  subAgentRegistry.set('tester', new TesterSubAgent());
  subAgentRegistry.set('docgen', new DocGenSubAgent());
  subAgentRegistry.set('architect', new ArchitectSubAgent());
}

export function getSubAgent(name: string): SubAgent | undefined {
  return subAgentRegistry.get(name);
}

export function listSubAgents(): string[] {
  return Array.from(subAgentRegistry.keys());
}
