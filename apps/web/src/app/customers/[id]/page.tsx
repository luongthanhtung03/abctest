'use client';

import { formatVnd } from '@abc/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, formatDateTime, STATUS_LABEL } from '@/lib/api';
import { CustomerDetail, CustomerInfo } from '@/components/CustomerInfo';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<CustomerDetail>(`/customers/${id}`).then(setC).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="alert error">{error}</div>;
  if (!c) return <p className="muted">Đang tải…</p>;

  return (
    <>
      <p>
        <Link href="/customers">← Khách hàng</Link>
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{c.name}</h1>
        <span className="spacer" />
        <Link className="btn" href={`/customers/${c.id}/quotes/new`}>
          + Tạo báo giá
        </Link>
      </div>

      <div className="card">
        <h2>Thông tin khách hàng</h2>
        <CustomerInfo c={c} />
      </div>

      <div className="card">
        <h2>Lịch sử báo giá</h2>
        {c.quotes.length === 0 ? (
          <p className="muted">Chưa có báo giá nào (bạn chỉ thấy báo giá do mình tạo, trừ Admin).</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Số báo giá</th>
                <th>Ngày tạo</th>
                <th>Người tạo</th>
                <th className="num">Tổng cộng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {c.quotes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/quotes/${q.id}`}>{q.quoteNo}</Link>
                  </td>
                  <td>{formatDateTime(q.createdAt)}</td>
                  <td>{q.createdBy}</td>
                  <td className="num">{formatVnd(q.total)} đ</td>
                  <td>
                    <span className={`badge ${q.status}`}>{STATUS_LABEL[q.status] ?? q.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
