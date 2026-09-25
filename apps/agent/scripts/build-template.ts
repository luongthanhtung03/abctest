/**
 * Generates templates/v1.docx: a normal Word document with docxtemplater placeholders.
 * In real use the business designs/edits the template in Word; this script just makes the
 * prototype's template reproducible. Each placeholder is written as a single run so Word
 * formatting can't split it.
 *
 * Run: npm run build-template -w @abc/agent
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { promises as fs } from 'fs';
import * as path from 'path';

const FONT = 'Arial';
const t = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? 20, bold: opts.bold, color: opts.color, italics: opts.italics });

const p = (runs: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, after = 60) =>
  new Paragraph({ children: runs, alignment: align, spacing: { after } });

const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const cell = (
  text: string,
  width: number,
  opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; shade?: string } = {},
) =>
  new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders,
    shading: opts.shade ? { fill: opts.shade } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [p([t(text, { bold: opts.bold })], opts.align ?? AlignmentType.LEFT, 0)],
  });

const infoRow = (label: string, value: string) =>
  new TableRow({
    children: [
      new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, borders: noBorders, children: [p([t(label, { bold: true })], AlignmentType.LEFT, 20)] }),
      new TableCell({ width: { size: 72, type: WidthType.PERCENTAGE }, borders: noBorders, children: [p([t(value)], AlignmentType.LEFT, 20)] }),
    ],
  });

const R = AlignmentType.RIGHT;
const C = AlignmentType.CENTER;
const HEAD = 'DCE6F1';

const itemsTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        cell('STT', 6, { bold: true, align: C, shade: HEAD }),
        cell('Sản phẩm', 30, { bold: true, shade: HEAD }),
        cell('Quy cách', 14, { bold: true, shade: HEAD }),
        cell('ĐVT', 7, { bold: true, align: C, shade: HEAD }),
        cell('Số lượng', 12, { bold: true, align: R, shade: HEAD }),
        cell('Đơn giá (VND)', 14, { bold: true, align: R, shade: HEAD }),
        cell('Thành tiền (VND)', 17, { bold: true, align: R, shade: HEAD }),
      ],
    }),
    // Loop row: docxtemplater repeats this row once per item.
    new TableRow({
      children: [
        cell('{#items}{no}', 6, { align: C }),
        cell('{name}', 30),
        cell('{spec}', 14),
        cell('{unit}', 7, { align: C }),
        cell('{quantity}', 12, { align: R }),
        cell('{unitPrice}', 14, { align: R }),
        cell('{lineTotal}{/items}', 17, { align: R }),
      ],
    }),
  ],
});

const totalRow = (label: string, value: string, bold = false) =>
  new TableRow({
    children: [
      new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, borders, children: [p([t(label, { bold })], R, 0)] }),
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders, children: [p([t(value, { bold })], R, 0)] }),
    ],
  });

const doc = new Document({
  creator: 'An Bình Chemtech (demo)',
  title: 'Báo giá {quoteNo}',
  sections: [
    {
      properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
      children: [
        p([t('CÔNG TY TNHH AN BÌNH CHEMTECH (DEMO)', { bold: true, size: 24, color: '1F4E79' })], AlignmentType.LEFT, 20),
        p([t('Địa chỉ: 123 Đường Mẫu, TP. Hồ Chí Minh · Hotline: 0280 000 000 · MST: 0000000000', { size: 16, color: '666666' })], AlignmentType.LEFT, 240),

        p([t('BÁO GIÁ', { bold: true, size: 36, color: '1F4E79' })], C, 40),
        p([t('Số: {quoteNo} · Ngày: {quoteDate}', { size: 20 })], C, 240),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            infoRow('Kính gửi:', '{customerName}'),
            infoRow('Mã khách hàng:', '{customerCode}'),
            infoRow('Mã số thuế:', '{taxCode}'),
            infoRow('Địa chỉ:', '{address}'),
            infoRow('Người liên hệ:', '{contactName} · {phone} · {email}'),
          ],
        }),
        p([t('')], AlignmentType.LEFT, 120),
        p([t('An Bình Chemtech trân trọng gửi Quý khách báo giá các sản phẩm như sau:')], AlignmentType.LEFT, 120),

        itemsTable,
        p([t('')], AlignmentType.LEFT, 60),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            totalRow('Cộng tiền hàng', '{subtotal}'),
            totalRow('Thuế GTGT ({vatRate}%)', '{vatAmount}'),
            totalRow('TỔNG CỘNG', '{total}', true),
          ],
        }),
        p([t('Bằng chữ: ', { bold: true }), t('{totalInWords}', { italics: true })], AlignmentType.LEFT, 240),

        p([t('ĐIỀU KHOẢN', { bold: true, size: 22, color: '1F4E79' })], AlignmentType.LEFT, 80),
        p([t('• Thanh toán: ', { bold: true }), t('{paymentTerms}')]),
        p([t('• Giao hàng: ', { bold: true }), t('{deliveryTerms}')]),
        p([t('• Hiệu lực báo giá: ', { bold: true }), t('đến hết ngày {validUntil}')]),
        p([t('• Ghi chú: ', { bold: true }), t('{notes}')], AlignmentType.LEFT, 360),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders, children: [p([t('')])] }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorders,
                  children: [
                    p([t('NHÂN VIÊN KINH DOANH', { bold: true })], C, 700),
                    p([t('{salesName}', { bold: true })], C, 20),
                    p([t('{salesEmail}', { size: 18, color: '666666' })], C, 0),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    },
  ],
});

async function main() {
  const out = path.resolve(__dirname, '..', 'templates', 'v1.docx');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, await Packer.toBuffer(doc));
  console.log(`Template written: ${out}`);
}
main();
