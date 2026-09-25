import { JobPayload } from '@abc/shared';
import { readFileSync } from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AiAssistant, normalizeWithGuardrails } from './ai/ai-assistant';
import { MockAiAssistant } from './ai/mock-ai';
import { JobError } from './errors';
import { buildTemplateData, renderDocx } from './render';
import { docxText, verifyDocx } from './verify';

const template = readFileSync(path.join(__dirname, '..', 'templates', 'v1.docx'));

const job: JobPayload = {
  jobId: 'job-1',
  quoteNo: 'BG-2026-0042',
  attempt: 1,
  templateVersion: 'v1',
  createdAt: '2026-09-25T02:30:00.000Z',
  salesperson: { name: 'Nguyễn Văn An', email: 'sales.a@anbinh.test' },
  customer: {
    code: 'KH001',
    name: 'Công ty TNHH Hóa chất Minh Phát',
    taxCode: '0312345678',
    address: 'KCN Tân Bình, TP.HCM',
    contactName: 'Phạm Minh Tuấn',
    phone: '0901234567',
    email: 'tuan@minhphat.test',
  },
  items: [
    { sku: 'NAOH-99', name: 'Xút vảy NaOH 99%', spec: 'Bao 25kg', unit: 'kg', quantity: 1000, unitPrice: 12500, lineTotal: 12_500_000 },
    { sku: 'HCL-32', name: 'Axit HCl 32%', spec: 'Can 30kg', unit: 'kg', quantity: 200, unitPrice: 4200, lineTotal: 840_000 },
  ],
  vatRate: 8,
  subtotal: 13_340_000,
  vatAmount: 1_067_200,
  total: 14_407_200,
  paymentTerms: 'ck 30 ngày',
  deliveryTerms: 'giao tại kho kh',
  validUntil: '2026-10-25',
  notes: 'giá chưa gồm bx, giao trong giờ hc',
};

const texts = { notes: job.notes, paymentTerms: job.paymentTerms, deliveryTerms: job.deliveryTerms, warnings: [] };

describe('render + verify', () => {
  it('fills every placeholder, repeats item rows and passes verification', () => {
    const out = renderDocx(template, buildTemplateData(job, texts));
    const text = docxText(out);
    expect(text).toContain('BG-2026-0042');
    expect(text).toContain('Xút vảy NaOH 99%');
    expect(text).toContain('Axit HCl 32%');
    expect(text).toContain('14.407.200');
    expect(text).toContain('Mười bốn triệu bốn trăm lẻ bảy nghìn hai trăm đồng');
    expect(text).not.toMatch(/\{[#/]?\w+\}/);
    expect(() => verifyDocx(out, job)).not.toThrow();
  });

  it('rejects an output whose total does not match the job (non-retryable)', () => {
    const out = renderDocx(template, buildTemplateData(job, texts));
    try {
      verifyDocx(out, { ...job, total: 999 });
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(JobError);
      expect((e as JobError).code).toBe('OUTPUT_INVALID');
      expect((e as JobError).retryable).toBe(false);
    }
  });

  it('reports missing template data instead of printing "undefined"', () => {
    const data = buildTemplateData(job, texts) as Record<string, unknown>;
    delete data.taxCode;
    expect(() => renderDocx(template, data)).toThrow(/taxCode/);
  });
});

describe('AI step', () => {
  it('mock normalises abbreviations and keeps the numbers', async () => {
    const r = await new MockAiAssistant().normalize({ notes: job.notes, paymentTerms: 'ck 30 ngày', deliveryTerms: 'x' });
    expect(r.notes).toBe('Giá chưa bao gồm chi phí bốc xếp. Giao trong giờ hành chính.');
    expect(r.paymentTerms).toBe('Chuyển khoản 30 ngày.');
  });

  it('mock warns about contradictory payment terms', async () => {
    const r = await new MockAiAssistant().normalize({ notes: 'thanh toán trước 100%', paymentTerms: 'công nợ 30 ngày', deliveryTerms: '' });
    expect(r.warnings).toHaveLength(1);
  });

  const input = { notes: 'a', paymentTerms: 'b', deliveryTerms: 'c' };

  it('falls back to the original text on timeout', async () => {
    const slow: AiAssistant = { name: 'slow', normalize: () => new Promise((r) => setTimeout(r, 1000)) };
    const out = await normalizeWithGuardrails(slow, input, 50);
    expect(out.usedAi).toBe(false);
    expect(out.result).toEqual({ ...input, warnings: [] });
    expect(out.fallbackReason).toMatch(/timeout/);
  });

  it('falls back when the AI output has the wrong shape', async () => {
    const bad: AiAssistant = { name: 'bad', normalize: async () => ({ text: 'hello' }) };
    const out = await normalizeWithGuardrails(bad, input, 1000);
    expect(out.usedAi).toBe(false);
  });

  it('falls back when the AI throws (e.g. Codex not installed)', async () => {
    const broken: AiAssistant = { name: 'broken', normalize: async () => { throw new Error('codex: not found'); } };
    const out = await normalizeWithGuardrails(broken, input, 1000);
    expect(out).toMatchObject({ usedAi: false, fallbackReason: 'codex: not found' });
  });
});
