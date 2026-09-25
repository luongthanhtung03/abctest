import { AiAssistant, AiInput } from './ai-assistant';

/**
 * Rule-based stand-in for Codex (AI_MODE=mock). Deterministic, runs offline,
 * and returns the same JSON shape the real AI step must return.
 */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bchưa gồm\b/gi, 'chưa bao gồm'],
  [/đã gồm\b/gi, 'đã bao gồm'], // no leading \b: JS \b is ASCII-only and "đ" isn't a word char
  [/\bbx\b/gi, 'chi phí bốc xếp'],
  [/\bvc\b/gi, 'chi phí vận chuyển'],
  [/\bhc\b/gi, 'hành chính'],
  [/\bck\b/gi, 'chuyển khoản'],
  [/\bkh\b/gi, 'khách hàng'],
  [/\bsl\b/gi, 'số lượng'],
  [/\bvat\b/gi, 'VAT'],
];

function tidy(text: string): string {
  let s = text.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  // One sentence per comma/semicolon-separated clause, each capitalised and ending with a period.
  return s
    .split(/[,;]\s*|\.\s+/)
    .map((c) => c.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1) + '.')
    .join(' ');
}

export class MockAiAssistant implements AiAssistant {
  readonly name = 'mock';

  async normalize(input: AiInput) {
    const warnings: string[] = [];
    const all = `${input.notes} ${input.paymentTerms}`.toLowerCase();
    if (/(trả trước|thanh toán trước)/.test(all) && /(công nợ|trả sau)/.test(all)) {
      warnings.push('Điều khoản thanh toán có thể mâu thuẫn: vừa "trả trước" vừa "công nợ".');
    }
    return {
      notes: tidy(input.notes),
      paymentTerms: tidy(input.paymentTerms),
      deliveryTerms: tidy(input.deliveryTerms),
      warnings,
    };
  }
}
