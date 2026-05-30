import { join } from 'path';
import { pathToFileURL } from 'url';

const agentPath = join(process.cwd(), '..', 'mimo-agent', 'dist', 'core', 'agent.js');
const agentUrl = pathToFileURL(agentPath).href;
console.log('URL:', agentUrl);

try {
  const m = await import(agentUrl);
  console.log('SUCCESS:', typeof m.Agent);
} catch (e) {
  console.error('FAIL:', e.message);
}
