import { join } from 'path';
import { pathToFileURL } from 'url';

const agentPath = join(process.cwd(), '..', 'mimo-agent', 'dist', 'core', 'agent.js');
const agentUrl = pathToFileURL(agentPath).href;
console.log('Loading agent from:', agentUrl);

const { Agent } = await eval(`import('${agentUrl}')`);
console.log('Agent loaded:', typeof Agent);

// Test creating agent instance
const agent = new Agent({
  model: 'mimo-v2.5-pro',
  apiBase: 'https://token-plan-cn.xiaomimimo.com/v1',
  apiKey: process.env.MIMO_API_KEY || '',
  maxTokens: 4096,
  temperature: 0.2,
  contextWindow: 128000,
  permissionMode: 'auto-edit',
  allowedTools: [],
  blockedTools: [],
  allowedPaths: [],
  maxTurns: 50,
  disableDefaultTools: [],
  sandbox: { enabled: false, image: '', memoryLimit: '512m', cpuLimit: 1, networkEnabled: false, timeout: 30000 },
  theme: 'dark',
  stream: true,
  verbose: false,
  subAgents: { enabled: false, maxConcurrent: 1 },
});

console.log('Agent created, initializing...');
await agent.initialize();
console.log('Agent initialized!');

// Test running
console.log('Testing agent.run("say hello")...');
const gen = agent.run('say hello', { streaming: true });
for await (const event of gen) {
  console.log('Event:', event.type, event.type === 'text' ? event.content.slice(0, 50) : '');
  if (event.type === 'done' || event.type === 'error') break;
}
console.log('Test complete!');
