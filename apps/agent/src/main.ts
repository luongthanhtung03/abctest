import { promises as fs } from 'fs';
import { AiAssistant } from './ai/ai-assistant';
import { CodexCliAssistant } from './ai/codex-ai';
import { MockAiAssistant } from './ai/mock-ai';
import { api } from './api-client';
import { config } from './config';
import { processJob } from './pipeline';

/**
 * "Mac mini" agent: pulls jobs from the backend (docs/03). It only makes outbound calls,
 * so it works behind the office router and simply catches up after being offline.
 */
let running = true;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ai: AiAssistant = config.aiMode === 'codex' ? new CodexCliAssistant() : new MockAiAssistant();

  // Leftovers from a crash mid-job are discarded; the job itself is simply redone.
  await fs.rm(config.tmpDir, { recursive: true, force: true });
  await fs.mkdir(config.tmpDir, { recursive: true });

  console.log(`Agent ${config.agentId} started · API ${config.apiUrl} · AI_MODE=${ai.name} · poll ${config.pollIntervalMs}ms`);
  let offline = false;

  while (running) {
    try {
      const job = await api.claim();
      if (offline) console.log('Backend reachable again');
      offline = false;
      if (job) {
        await processJob(job, ai);
        continue; // look for the next job right away
      }
    } catch (e) {
      if (!offline) console.warn(`Backend unreachable, will retry: ${(e as Error).message}`);
      offline = true;
    }
    await sleep(config.pollIntervalMs);
  }
  console.log('Agent stopped');
}

// Finish the current job before exiting.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (!running) process.exit(1);
    console.log('Stopping after the current job… (press again to force)');
    running = false;
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
