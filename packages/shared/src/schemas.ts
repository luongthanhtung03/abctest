import { z } from 'zod';

// One schema, validated in 3 places: web form, backend, agent (docs/08).

export const VAT_RATES = [0, 5, 8, 10] as const;

export const QuoteStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const MAX_ATTEMPTS = 3;

/** What the salesperson submits (POST /quotes). Totals are NOT accepted from the client. */
export const createQuoteSchema = z.object({
  customerId: z.string().min(1, 'Chưa chọn khách hàng'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Chưa chọn sản phẩm'),
        quantity: z.number().int('Số lượng phải là số nguyên').positive('Số lượng phải > 0').max(10_000_000),
        unitPrice: z.number().int('Đơn giá phải là số nguyên (VND)').min(0, 'Đơn giá không được âm').max(1_000_000_000),
      }),
    )
    .min(1, 'Cần ít nhất 1 dòng sản phẩm')
    .max(50, 'Tối đa 50 dòng sản phẩm'),
  vatRate: z.number().refine((v) => (VAT_RATES as readonly number[]).includes(v), 'VAT phải là 0, 5, 8 hoặc 10%'),
  paymentTerms: z.string().trim().min(1, 'Nhập điều kiện thanh toán').max(500),
  deliveryTerms: z.string().trim().min(1, 'Nhập điều kiện giao hàng').max(500),
  validityDays: z.number().int().min(1, 'Hiệu lực tối thiểu 1 ngày').max(90, 'Hiệu lực tối đa 90 ngày'),
  notes: z.string().trim().max(1000).default(''),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/** The frozen snapshot the backend hands to the Mac mini agent (docs/04). */
export const jobPayloadSchema = z.object({
  jobId: z.string(),
  quoteNo: z.string(),
  attempt: z.number().int(),
  templateVersion: z.string(),
  createdAt: z.string(),
  salesperson: z.object({ name: z.string(), email: z.string() }),
  customer: z.object({
    code: z.string(),
    name: z.string(),
    taxCode: z.string(),
    address: z.string(),
    contactName: z.string(),
    phone: z.string(),
    email: z.string(),
  }),
  items: z
    .array(
      z.object({
        sku: z.string(),
        name: z.string(),
        spec: z.string(),
        unit: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().min(0),
        lineTotal: z.number().int().min(0),
      }),
    )
    .min(1),
  vatRate: z.number(),
  subtotal: z.number().int(),
  vatAmount: z.number().int(),
  total: z.number().int(),
  paymentTerms: z.string(),
  deliveryTerms: z.string(),
  validUntil: z.string(),
  notes: z.string(),
});
export type JobPayload = z.infer<typeof jobPayloadSchema>;

/** Agent → backend failure report. */
export const agentFailSchema = z.object({
  code: z.string().min(1),
  message: z.string().max(2000),
  retryable: z.boolean(),
});
export type AgentFailInput = z.infer<typeof agentFailSchema>;

/** Required shape of the AI step's output (docs/07). */
export const aiResultSchema = z.object({
  notes: z.string().max(2000),
  paymentTerms: z.string().max(1000),
  deliveryTerms: z.string().max(1000),
  warnings: z.array(z.string().max(500)).max(10),
});
export type AiResult = z.infer<typeof aiResultSchema>;
