import { AiResult, aiResultSchema } from '@abc/shared';

/**
 * The AI step (docs/07): only free-text fields go in, only text comes out.
 * Numbers, totals and the template are never touched by AI.
 */
export interface AiInput {
  notes: string;
  paymentTerms: string;
  deliveryTerms: string;
}

export interface AiAssistant {
  readonly name: string;
  normalize(input: AiInput): Promise<unknown>;
}

export interface AiOutcome {
  result: AiResult;
  usedAi: boolean;
  /** Why the original text was kept (timeout, invalid output, error). */
  fallbackReason?: string;
}

/**
 * Guardrails around any AiAssistant: timeout + schema validation + fallback.
 * AI is an enhancement, not a dependency: on any problem the original text is used
 * and the quote is still generated.
 */
export async function normalizeWithGuardrails(
  assistant: AiAssistant,
  input: AiInput,
  timeoutMs: number,
): Promise<AiOutcome> {
  const original: AiResult = { ...input, warnings: [] };
  let timer: NodeJS.Timeout | undefined;
  try {
    const raw = await Promise.race([
      assistant.normalize(input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout sau ${timeoutMs / 1000}s`)), timeoutMs);
      }),
    ]);
    const parsed = aiResultSchema.safeParse(raw);
    if (!parsed.success) return { result: original, usedAi: false, fallbackReason: 'kết quả AI sai định dạng' };
    return { result: parsed.data, usedAi: true };
  } catch (e) {
    return { result: original, usedAi: false, fallbackReason: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
