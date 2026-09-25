import { AgentFailInput } from '@abc/shared';
import { config } from './config';

/** Thin HTTP client for the backend's /agent/* endpoints. The agent never touches the DB. */

const headers = () => ({ 'X-Agent-Key': config.apiKey, 'X-Agent-Id': config.agentId });

async function request(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${config.apiUrl}${path}`, { ...init, headers: { ...headers(), ...init.headers } });
  if (!res.ok && res.status !== 204) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  }
  return res;
}

/** Report calls are retried a few times so a short network blip doesn't lose the result. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3, delayMs = 2000): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export const api = {
  /** Returns the job payload, or null when there is nothing to do (204). */
  async claim(): Promise<unknown | null> {
    const res = await request('/agent/jobs/claim', { method: 'POST' });
    return res.status === 204 ? null : res.json();
  },

  complete(jobId: string, file: Buffer, fileName: string) {
    return withRetry(async () => {
      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(file)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        fileName,
      );
      await request(`/agent/jobs/${jobId}/complete`, { method: 'POST', body: form });
    });
  },

  fail(jobId: string, report: AgentFailInput) {
    return withRetry(() =>
      request(`/agent/jobs/${jobId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      }),
    );
  },

  /** Best-effort timeline entry (e.g. AI fallback); never fails the job. */
  async event(jobId: string, type: string, message: string) {
    try {
      await request(`/agent/jobs/${jobId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message }),
      });
    } catch {
      /* informational only */
    }
  },
};
