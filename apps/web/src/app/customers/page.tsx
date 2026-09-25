'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Customer {
  id: string;
  code: string;
  name: string;
  taxCode: string;
  contactName: string;
  phone: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    api<Customer[]>('/customers').then(setCustomers).catch(() => setCustomers([]));
  }, []);

  return (
    <>
      <h1>Khách hàng</h1>
      <div className="card">
        {!customers ? (
          <p className="muted">Đang tải…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên khách hàng</th>
                <th>Mã số thuế</th>
                <th>Người liên hệ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>
                    <Link href={`/customers/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.taxCode}</td>
                  <td>
                    {c.contactName} · {c.phone}
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
