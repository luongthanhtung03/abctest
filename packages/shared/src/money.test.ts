import { describe, expect, it } from 'vitest';
import { computeTotals, formatDateVn, formatVnd, vndToWords } from './money';
import { createQuoteSchema } from './schemas';

describe('computeTotals', () => {
  it('computes lines, subtotal, VAT and total in integer VND', () => {
    const t = computeTotals(
      [
        { quantity: 1000, unitPrice: 12500 },
        { quantity: 200, unitPrice: 4200 },
      ],
      8,
    );
    expect(t.lineTotals).toEqual([12_500_000, 840_000]);
    expect(t.subtotal).toBe(13_340_000);
    expect(t.vatAmount).toBe(1_067_200);
    expect(t.total).toBe(14_407_200);
  });

  it('rounds VAT to whole VND', () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 333 }], 5).vatAmount).toBe(17);
  });
});

describe('vndToWords', () => {
  it.each([
    [0, 'Không đồng'],
    [5, 'Năm đồng'],
    [15, 'Mười lăm đồng'],
    [21, 'Hai mươi mốt đồng'],
    [105, 'Một trăm lẻ năm đồng'],
    [1000, 'Một nghìn đồng'],
    [1005, 'Một nghìn không trăm lẻ năm đồng'],
    [1_000_010, 'Một triệu không trăm mười đồng'],
    [2_025_000, 'Hai triệu không trăm hai mươi lăm nghìn đồng'],
    [13_500_000, 'Mười ba triệu năm trăm nghìn đồng'],
    [1_000_000_000, 'Một tỷ đồng'],
    [1_250_000_000, 'Một tỷ hai trăm năm mươi triệu đồng'],
  ])('%i → %s', (n, words) => {
    expect(vndToWords(n)).toBe(words);
  });
});

describe('formatting', () => {
  it('formats VND with dot separators', () => {
    expect(formatVnd(13_500_000)).toBe('13.500.000');
    expect(formatVnd(950)).toBe('950');
  });
  it('formats dates as dd/mm/yyyy', () => {
    expect(formatDateVn('2026-10-25')).toBe('25/10/2026');
    expect(formatDateVn('2026-09-25T09:30:00.000Z')).toBe('25/09/2026');
  });
});

describe('createQuoteSchema', () => {
  const valid = {
    customerId: 'c1',
    items: [{ productId: 'p1', quantity: 10, unitPrice: 1000 }],
    vatRate: 8,
    paymentTerms: 'Chuyển khoản 30 ngày',
    deliveryTerms: 'Giao tại kho',
    validityDays: 30,
  };

  it('accepts a valid quote and defaults notes', () => {
    const r = createQuoteSchema.parse(valid);
    expect(r.notes).toBe('');
  });

  it('rejects zero quantity, bad VAT and empty items with field paths', () => {
    const r = createQuoteSchema.safeParse({
      ...valid,
      vatRate: 7,
      items: [{ productId: 'p1', quantity: 0, unitPrice: 1000 }],
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('items.0.quantity');
    expect(paths).toContain('vatRate');
    expect(createQuoteSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });
});
