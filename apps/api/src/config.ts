import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (copy apps/api/.env.example to apps/api/.env)`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET'),
  agentApiKey: required('AGENT_API_KEY'),
  currentTemplateVersion: process.env.CURRENT_TEMPLATE_VERSION ?? 'v1',
  storageDir: process.env.STORAGE_DIR ?? './storage',
  /** Agent counts as offline if not seen for this long. */
  agentOfflineAfterMs: 60_000,
};
