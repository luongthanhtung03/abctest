import { formatVnd, JobPayload } from '@abc/shared';
import PizZip from 'pizzip';
import { JobError } from './errors';

/** Plain text of the document body (all <w:t> runs joined). */
export function docxText(file: Buffer): string {
  const xml = new PizZip(file).file('word/document.xml')?.asText();
  if (!xml) throw new Error('word/document.xml not found');
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

/**
 * Re-opens the generated file before upload (docs/08). A failure here means the same
 * input would fail again, so it is non-retryable (OUTPUT_INVALID).
 */
export function verifyDocx(file: Buffer, job: JobPayload): void {
  let text: string;
  try {
    text = docxText(file);
  } catch (e) {
    throw new JobError('OUTPUT_INVALID', `File không mở được: ${(e as Error).message}`, false);
  }
  const leftover = text.match(/\{[#/]?[\w.]+\}/);
  if (leftover) throw new JobError('OUTPUT_INVALID', `Còn placeholder chưa thay: ${leftover[0]}`, false);
  if (!text.includes(job.quoteNo)) throw new JobError('OUTPUT_INVALID', 'File thiếu số báo giá', false);
  if (!text.includes(formatVnd(job.total))) throw new JobError('OUTPUT_INVALID', 'File thiếu tổng tiền', false);
}
