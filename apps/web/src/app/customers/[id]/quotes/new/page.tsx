'use client';

import { computeTotals, createQuoteSchema, formatVnd, VAT_RATES } from '@abc/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CustomerDetail, CustomerInfo } from '@/components/CustomerInfo';
import { api, ApiError } from '@/lib/api';

interface Product {
  id: string;
  sku: string;
  name: string;
  spec: string;
  unit: string;
  listPrice: number;
}

interface Line {
  productId: string;
  quantity: string;
  unitPrice: string;
}

type Errors = Record<string, string>;

const emptyLine = (): Line => ({ productId: '', quantity: '', unitPrice: '' });

export default function NewQuotePage() {
  const { id: customerId } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [vatRate, setVatRate] = useState(8);
  const [paymentTerms, setPaymentTerms] = useState('Chuyển khoản 30 ngày kể từ ngày giao hàng');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [notes, setNotes] = useState('');

  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState('');
  const [sending, setSending] = useState(false);
  // One key per opening of the form: double-clicks and network retries can't create a second quote.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    api<CustomerDetail>(`/customers/${customerId}`).then(setCustomer);
    api<Product[]>('/products').then(setProducts);
  }, [customerId]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const input = {
    customerId,
    items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    vatRate,
    paymentTerms,
    deliveryTerms,
    validityDays: Number(validityDays),
    notes,
  };
  // Preview only — the backend recalculates with the same shared function.
  const totals = computeTotals(
    input.items.map((i) => ({ quantity: i.quantity || 0, unitPrice: i.unitPrice || 0 })),
    vatRate,
  );

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function selectProduct(idx: number, productId: string) {
    const p = productById.get(productId);
    updateLine(idx, { productId, unitPrice: p ? String(p.listPrice) : '' });
  }

  function toErrors(list: { field: string; message: string }[]): Errors {
    return Object.fromEntries(list.map((e) => [e.field, e.message]));
  }

  function review() {
    const r = createQuoteSchema.safeParse(input);
    if (!r.success) {
      setErrors(toErrors(r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))));
      return;
    }
    setErrors({});
    setStep('review');
  }

  async function send() {
    setSending(true);
    setSubmitError('');
    try {
      const res = await api<{ id: string }>('/quotes', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(input),
      });
      router.push(`/quotes/${res.id}`);
    } catch (e) {
      const err = e as ApiError;
      setErrors(toErrors(err.fieldErrors ?? []));
      setSubmitError(err.message);
      setStep('edit');
      setSending(false);
    }
  }

  if (!customer) return <p className="muted">Đang tải…</p>;
  const err = (field: string) => errors[field] && <div className="error">{errors[field]}</div>;

  return (
    <>
      <p>
        <Link href={`/customers/${customerId}`}>← {customer.name}</Link>
      </p>
      <h1>{step === 'edit' ? 'Tạo báo giá' : 'Xem lại báo giá'}</h1>

      <div className="card">
        <h2>Khách hàng: {customer.name}</h2>
        <CustomerInfo c={customer} />
      </div>

      {submitError && <div className="alert error">{submitError}</div>}

      {step === 'edit' ? (
        <>
          <div className="card">
            <h2>Sản phẩm</h2>
            {err('items')}
            <table>
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Sản phẩm</th>
                  <th>Quy cách</th>
                  <th className="num" style={{ width: '13%' }}>Số lượng</th>
                  <th className="num" style={{ width: '16%' }}>Đơn giá (VND)</th>
                  <th className="num">Thành tiền</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const p = productById.get(l.productId);
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          value={l.productId}
                          onChange={(e) => selectProduct(idx, e.target.value)}
                          className={errors[`items.${idx}.productId`] ? 'invalid' : ''}
                        >
                          <option value="">— Chọn sản phẩm —</option>
                          {products.map((pr) => (
                            <option key={pr.id} value={pr.id}>
                              {pr.name}
                            </option>
                          ))}
                        </select>
                        {err(`items.${idx}.productId`)}
                      </td>
                      <td className="muted">{p ? `${p.spec} · ${p.unit}` : '—'}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          className={errors[`items.${idx}.quantity`] ? 'invalid' : ''}
                        />
                        {err(`items.${idx}.quantity`)}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={l.unitPrice}
                          onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                          className={errors[`items.${idx}.unitPrice`] ? 'invalid' : ''}
                        />
                        {err(`items.${idx}.unitPrice`)}
                      </td>
                      <td className="num">{formatVnd(totals.lineTotals[idx] || 0)}</td>
                      <td>
                        {lines.length > 1 && (
                          <button className="link" title="Xoá dòng" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>
              <button className="secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
                + Thêm dòng
              </button>
            </p>
            <TotalsTable subtotal={totals.subtotal} vatRate={vatRate} vatAmount={totals.vatAmount} total={totals.total} />
          </div>

          <div className="card">
            <h2>Điều khoản</h2>
            <div className="grid2">
              <div className="field">
                <label>Thuế GTGT</label>
                <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}>
                  {VAT_RATES.map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Hiệu lực (ngày)</label>
                <input type="number" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className={errors.validityDays ? 'invalid' : ''} />
                {err('validityDays')}
              </div>
            </div>
            <div className="field">
              <label>Điều kiện thanh toán</label>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={errors.paymentTerms ? 'invalid' : ''} />
              {err('paymentTerms')}
            </div>
            <div className="field">
              <label>Điều kiện giao hàng</label>
              <input
                value={deliveryTerms}
                placeholder="VD: giao tại kho kh trong 5 ngày"
                onChange={(e) => setDeliveryTerms(e.target.value)}
                className={errors.deliveryTerms ? 'invalid' : ''}
              />
              {err('deliveryTerms')}
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <textarea value={notes} placeholder="VD: giá chưa gồm bx, giao trong giờ hc" onChange={(e) => setNotes(e.target.value)} />
              <div className="muted" style={{ fontSize: 12 }}>
                Ghi chú và điều khoản sẽ được AI chuẩn hoá câu chữ trên Mac mini (không thay đổi số liệu).
              </div>
            </div>
          </div>

          <div className="row">
            <span className="spacer" />
            <button onClick={review}>Xem lại →</button>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h2>Sản phẩm</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sản phẩm</th>
                  <th>Quy cách</th>
                  <th className="num">Số lượng</th>
                  <th className="num">Đơn giá</th>
                  <th className="num">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {input.items.map((it, idx) => {
                  const p = productById.get(it.productId)!;
                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{p.name}</td>
                      <td>
                        {p.spec} · {p.unit}
                      </td>
                      <td className="num">{formatVnd(it.quantity)}</td>
                      <td className="num">{formatVnd(it.unitPrice)}</td>
                      <td className="num">{formatVnd(totals.lineTotals[idx])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TotalsTable subtotal={totals.subtotal} vatRate={vatRate} vatAmount={totals.vatAmount} total={totals.total} />
          </div>
          <div className="card">
            <h2>Điều khoản</h2>
            <dl className="info">
              <dt>Thanh toán</dt>
              <dd>{paymentTerms}</dd>
              <dt>Giao hàng</dt>
              <dd>{deliveryTerms}</dd>
              <dt>Hiệu lực</dt>
              <dd>{validityDays} ngày</dd>
              <dt>Ghi chú</dt>
              <dd>{notes || '—'}</dd>
            </dl>
          </div>
          <div className="row">
            <button className="secondary" onClick={() => setStep('edit')} disabled={sending}>
              ← Sửa
            </button>
            <span className="spacer" />
            <button onClick={send} disabled={sending}>
              {sending ? 'Đang gửi…' : 'Gửi'}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function TotalsTable(t: { subtotal: number; vatRate: number; vatAmount: number; total: number }) {
  return (
    <table className="totals">
      <tbody>
        <tr>
          <td>Cộng tiền hàng</td>
          <td className="num">{formatVnd(t.subtotal)} đ</td>
        </tr>
        <tr>
          <td>Thuế GTGT ({t.vatRate}%)</td>
          <td className="num">{formatVnd(t.vatAmount)} đ</td>
        </tr>
        <tr className="grand">
          <td>Tổng cộng</td>
          <td className="num">{formatVnd(t.total)} đ</td>
        </tr>
      </tbody>
    </table>
  );
}
