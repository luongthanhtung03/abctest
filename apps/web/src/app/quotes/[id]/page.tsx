'use client';

import { formatDateVn, formatVnd, JobPayload } from '@abc/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, formatDateTime, STATUS_LABEL } from '@/lib/api';

interface QuoteEvent {
  id: string;
  type: string;
  message: string | null;
  createdAt: string;
}

interface QuoteDetail {
  id: string;
  quoteNo: string;
  customerId: string;
  status: string;
  total: number;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  hasFile: boolean;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  payload: Omit<JobPayload, 'jobId' | 'attempt'>;
  events: QuoteEvent[];
  agent: { online: boolean; lastSeenAt: string | null };
}

const TERMINAL = ['COMPLETED', 'FAILED'];
const POLL_MS = 3000;

export default function QuotePage() {
  const { id } = useParams<{ id: string }>();
  const [q, setQ] = useState<QuoteDetail | null>(null);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(
    () =>
      api<QuoteDetail>(`/quotes/${id}`)
        .then(setQ)
        .catch((e) => setError(e.message)),
    [id],
  );

  // Poll every 3s while the job is not finished; stop at a terminal status (docs/04).
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!q || TERMINAL.includes(q.status)) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [q?.status, load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function retry() {
    setRetrying(true);
    try {
      await api(`/quotes/${id}/retry`, { method: 'POST' });
      await load();
    } finally {
      setRetrying(false);
    }
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!q) return <p className="muted">Đang tải…</p>;
  const p = q.payload;

  return (
    <>
      <p>
        <Link href={`/customers/${q.customerId}`}>← {p.customer.name}</Link>
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Báo giá {q.quoteNo}</h1>
        <span className={`badge ${q.status}`}>{STATUS_LABEL[q.status] ?? q.status}</span>
        <span className="spacer" />
        {q.status === 'COMPLETED' && q.hasFile && (
          <a className="btn" href={`/api/quotes/${q.id}/file`}>
            ⬇ Tải file báo giá (.docx)
          </a>
        )}
        {q.status === 'FAILED' && (
          <button onClick={retry} disabled={retrying}>
            {retrying ? 'Đang gửi lại…' : '↻ Thử lại'}
          </button>
        )}
      </div>

      {q.status === 'PENDING' && !q.agent.online && (
        <div className="alert warn">
          ⚠️ <b>Mac mini đang mất kết nối</b>
          {q.agent.lastSeenAt ? ` (lần cuối thấy lúc ${formatDateTime(q.agent.lastSeenAt)})` : ''}. Báo giá vẫn được giữ trong hàng đợi và sẽ tự động được
          xử lý khi Mac mini kết nối lại.
        </div>
      )}
      {q.status === 'PENDING' && q.agent.online && <div className="alert warn">⏳ Đang chờ Mac mini nhận yêu cầu…</div>}
      {q.status === 'PROCESSING' && <div className="alert warn">⚙️ Mac mini đang tạo file báo giá (lần {q.attempts}/3)…</div>}
      {q.status === 'FAILED' && (
        <div className="alert error">
          Không tạo được file: <b>{q.errorCode}</b> — {q.errorMessage}
        </div>
      )}

      <div className="card">
        <h2>Tiến trình</h2>
        <ul className="timeline">
          {q.events.map((e) => (
            <li key={e.id}>
              <span className="time">{formatDateTime(e.createdAt)}</span>
              {e.message ?? e.type}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Nội dung đã gửi (snapshot)</h2>
        <dl className="info" style={{ marginBottom: 12 }}>
          <dt>Người tạo</dt>
          <dd>{q.createdBy}</dd>
          <dt>Phiên bản mẫu</dt>
          <dd>{p.templateVersion}</dd>
          <dt>Hiệu lực đến</dt>
          <dd>{formatDateVn(p.validUntil)}</dd>
        </dl>
        <table>
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Quy cách</th>
              <th className="num">Số lượng</th>
              <th className="num">Đơn giá</th>
              <th className="num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td>
                <td>
                  {it.spec} · {it.unit}
                </td>
                <td className="num">{formatVnd(it.quantity)}</td>
                <td className="num">{formatVnd(it.unitPrice)}</td>
                <td className="num">{formatVnd(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="totals">
          <tbody>
            <tr>
              <td>Cộng tiền hàng</td>
              <td className="num">{formatVnd(p.subtotal)} đ</td>
            </tr>
            <tr>
              <td>Thuế GTGT ({p.vatRate}%)</td>
              <td className="num">{formatVnd(p.vatAmount)} đ</td>
            </tr>
            <tr className="grand">
              <td>Tổng cộng</td>
              <td className="num">{formatVnd(p.total)} đ</td>
            </tr>
          </tbody>
        </table>
        <dl className="info">
          <dt>Thanh toán (gốc)</dt>
          <dd>{p.paymentTerms}</dd>
          <dt>Giao hàng (gốc)</dt>
          <dd>{p.deliveryTerms}</dd>
          <dt>Ghi chú (gốc)</dt>
          <dd>{p.notes || '—'}</dd>
        </dl>
      </div>
    </>
  );
}
