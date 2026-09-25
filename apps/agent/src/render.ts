import { AiResult, formatDateVn, formatVnd, JobPayload, vndToWords } from '@abc/shared';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { JobError } from './errors';

/** Maps the frozen snapshot to template fields. Pure formatting — no business decisions here. */
export function buildTemplateData(job: JobPayload, texts: AiResult) {
  return {
    quoteNo: job.quoteNo,
    quoteDate: formatDateVn(job.createdAt),
    validUntil: formatDateVn(job.validUntil),
    salesName: job.salesperson.name,
    salesEmail: job.salesperson.email,
    customerName: job.customer.name,
    customerCode: job.customer.code,
    taxCode: job.customer.taxCode,
    address: job.customer.address,
    contactName: job.customer.contactName,
    phone: job.customer.phone,
    email: job.customer.email,
    items: job.items.map((it, i) => ({
      no: i + 1,
      name: it.name,
      spec: it.spec,
      unit: it.unit,
      quantity: formatVnd(it.quantity),
      unitPrice: formatVnd(it.unitPrice),
      lineTotal: formatVnd(it.lineTotal),
    })),
    subtotal: formatVnd(job.subtotal),
    vatRate: job.vatRate,
    vatAmount: formatVnd(job.vatAmount),
    total: formatVnd(job.total),
    totalInWords: vndToWords(job.total),
    paymentTerms: texts.paymentTerms,
    deliveryTerms: texts.deliveryTerms,
    notes: texts.notes || '—',
  };
}

/** Fills a copy of the template. Any template/data mismatch is non-retryable. */
export function renderDocx(template: Buffer, data: Record<string, unknown>): Buffer {
  const missing: string[] = [];
  try {
    const doc = new Docxtemplater(new PizZip(template), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (part: { value: string }) => {
        missing.push(part.value);
        return '';
      },
    });
    doc.render(data);
    if (missing.length) {
      throw new JobError('TEMPLATE_DATA_MISSING', `Thiếu dữ liệu cho: ${missing.join(', ')}`, false);
    }
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  } catch (e) {
    if (e instanceof JobError) throw e;
    throw new JobError('TEMPLATE_ERROR', `Mẫu báo giá lỗi: ${(e as Error).message}`, false);
  }
}
