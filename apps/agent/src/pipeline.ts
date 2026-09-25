import { JobPayload, jobPayloadSchema } from '@abc/shared';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AiAssistant, normalizeWithGuardrails } from './ai/ai-assistant';
import { api } from './api-client';
import { config } from './config';
import { JobError } from './errors';
import { buildTemplateData, renderDocx } from './render';
import { verifyDocx } from './verify';

const log = (job: { jobId: string; attempt: number }, msg: string) =>
  console.log(`[quote=${job.jobId} attempt=${job.attempt}] ${msg}`);

/**
 * validate → AI step → fill a copy of the template → verify → upload.
 * Every step is safe to repeat: same snapshot → same file (docs/05).
 */
export async function processJob(raw: unknown, ai: AiAssistant): Promise<void> {
  const parsed = jobPayloadSchema.safeParse(raw);
  const ref = { jobId: String((raw as JobPayload)?.jobId ?? 'unknown'), attempt: Number((raw as JobPayload)?.attempt ?? 0) };
  if (!parsed.success) {
    await api.fail(ref.jobId, { code: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message ?? 'invalid', retryable: false });
    return;
  }
  const job = parsed.data;
  // Per-attempt working dir: leftovers from a crashed attempt never mix with this one.
  const workDir = path.join(config.tmpDir, job.jobId, String(job.attempt));

  try {
    log(job, `processing ${job.quoteNo}`);
    if (config.simulateFail) throw new JobError('SIMULATED', 'Lỗi giả lập (SIMULATE_FAIL=1)', true);

    // 1. AI step — text only, guarded, never blocks the quote.
    const aiOutcome = await normalizeWithGuardrails(
      ai,
      { notes: job.notes, paymentTerms: job.paymentTerms, deliveryTerms: job.deliveryTerms },
      config.aiTimeoutMs,
    );
    if (aiOutcome.usedAi) {
      await api.event(job.jobId, 'AI_NORMALIZED', `AI (${ai.name}) đã chuẩn hoá ghi chú và điều khoản`);
      for (const w of aiOutcome.result.warnings) await api.event(job.jobId, 'AI_WARNING', w);
    } else {
      await api.event(job.jobId, 'AI_FALLBACK', `AI không khả dụng (${aiOutcome.fallbackReason}) — dùng văn bản gốc`);
    }

    // 2. Copy the pinned template version into the working dir, then fill the copy.
    const templatePath = path.join(config.templatesDir, `${job.templateVersion}.docx`);
    await fs.mkdir(workDir, { recursive: true });
    const workingCopy = path.join(workDir, 'template.docx');
    try {
      await fs.copyFile(templatePath, workingCopy);
    } catch {
      throw new JobError('TEMPLATE_NOT_FOUND', `Không tìm thấy mẫu ${job.templateVersion}`, false);
    }
    const output = renderDocx(await fs.readFile(workingCopy), buildTemplateData(job, aiOutcome.result));
    const outPath = path.join(workDir, `${job.quoteNo}.docx`);
    await fs.writeFile(outPath, output);

    // 3. Verify, then upload. The file only "exists" for users once /complete succeeds.
    verifyDocx(output, job);
    await api.complete(job.jobId, output, `${job.quoteNo}.docx`);
    log(job, `completed (${Math.round(output.length / 1024)} KB)`);
  } catch (e) {
    const err = e instanceof JobError ? e : new JobError('UNEXPECTED', (e as Error).message, true);
    log(job, `failed ${err.code}: ${err.message} (retryable=${err.retryable})`);
    try {
      await api.fail(job.jobId, { code: err.code, message: err.message, retryable: err.retryable });
    } catch (reportErr) {
      // Backend unreachable: the job stays PROCESSING. In production the lease sweep requeues it (docs/05).
      log(job, `could not report failure: ${(reportErr as Error).message}`);
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }); // no customer data left on the Mac mini
  }
}
