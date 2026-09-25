// Deterministic money logic – shared by the web preview and the backend (docs/07: code, not AI).
// All amounts are integer VND.

export interface LineInput {
  quantity: number;
  unitPrice: number;
}

export interface Totals {
  lineTotals: number[];
  subtotal: number;
  vatAmount: number;
  total: number;
}

export function computeTotals(items: LineInput[], vatRate: number): Totals {
  const lineTotals = items.map((i) => i.quantity * i.unitPrice);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const vatAmount = Math.round((subtotal * vatRate) / 100);
  return { lineTotals, subtotal, vatAmount, total: subtotal + vatAmount };
}

/** 13500000 → "13.500.000" */
export function formatVnd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "2026-10-25" or ISO datetime → "25/10/2026" */
export function formatDateVn(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Reads a 0–999 group. `full` = not the leading group, so "không trăm" / "lẻ" are spelled out. */
function readTriple(n: number, full: boolean): string[] {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];

  if (full || h > 0) parts.push(DIGITS[h], 'trăm');

  if (t === 0) {
    if (u > 0 && (full || h > 0)) parts.push('lẻ');
  } else if (t === 1) {
    parts.push('mười');
  } else {
    parts.push(DIGITS[t], 'mươi');
  }

  if (u > 0) {
    if (u === 1 && t >= 2) parts.push('mốt');
    else if (u === 5 && t >= 1) parts.push('lăm');
    else parts.push(DIGITS[u]);
  }
  return parts;
}

function readBelowBillion(n: number, leadingFull: boolean): string[] {
  const groups = [
    { value: Math.floor(n / 1_000_000), unit: 'triệu' },
    { value: Math.floor((n % 1_000_000) / 1000), unit: 'nghìn' },
    { value: n % 1000, unit: '' },
  ];
  const parts: string[] = [];
  let started = leadingFull;
  for (const g of groups) {
    if (g.value === 0) continue;
    parts.push(...readTriple(g.value, started));
    if (g.unit) parts.push(g.unit);
    started = true;
  }
  return parts;
}

function readNumber(n: number): string[] {
  if (n >= 1_000_000_000) {
    const parts = [...readNumber(Math.floor(n / 1_000_000_000)), 'tỷ'];
    const rest = n % 1_000_000_000;
    if (rest > 0) parts.push(...readBelowBillion(rest, true));
    return parts;
  }
  return readBelowBillion(n, false);
}

/** 13500000 → "Mười ba triệu năm trăm nghìn đồng" */
export function vndToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('vndToWords expects a non-negative integer');
  const text = n === 0 ? 'không' : readNumber(n).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1) + ' đồng';
}
