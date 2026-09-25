import 'dotenv/config';
import * as path from 'path';

export const config = {
  apiUrl: (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, ''),
  apiKey: process.env.AGENT_API_KEY ?? '',
  agentId: process.env.AGENT_ID ?? 'macmini-1',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  aiMode: (process.env.AI_MODE ?? 'mock') as 'mock' | 'codex',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60_000),
  templatesDir: path.resolve(process.env.TEMPLATES_DIR ?? './templates'),
  tmpDir: path.resolve(process.env.TMP_DIR ?? './tmp'),
  simulateFail: process.env.SIMULATE_FAIL === '1',
};

if (!config.apiKey) {
  throw new Error('Missing AGENT_API_KEY (copy apps/agent/.env.example to apps/agent/.env)');
}
