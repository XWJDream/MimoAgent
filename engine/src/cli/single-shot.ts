import type { MimoConfig } from '../config/types.js';
import { Agent } from '../core/agent.js';
import type { LoopEvent } from '../core/agent-loop.js';
import { CodexRenderer } from '../tui/renderer.js';

const renderer = new CodexRenderer();

export async function runSingleShot(prompt: string, config: MimoConfig): Promise<void> {
  const agent = new Agent(config);
  await agent.initialize();

  renderer.renderUserInput(prompt);
  renderer.startAssistantTurn();

  try {
    const stream = agent.run(prompt);
    for await (const event of stream) {
      handleEvent(event);
    }
    renderer.endAssistantTurn();

    const tracker = agent.getUsageTracker();
    renderer.renderUsageSummary(tracker.getStats());
  } catch (error) {
    renderer.endAssistantTurn();
    renderer.renderError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function handleEvent(event: LoopEvent): void {
  switch (event.type) {
    case 'text':
      renderer.streamToken(event.content);
      break;
    case 'tool_start':
      renderer.renderToolStart(event.name, event.args);
      break;
    case 'tool_result':
      renderer.renderToolResult(event.name, event.result);
      break;
    case 'done':
      break;
    case 'error':
      renderer.renderError(event.message);
      break;
  }
}
