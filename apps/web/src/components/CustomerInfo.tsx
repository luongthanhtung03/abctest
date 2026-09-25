export interface CustomerDetail {
  id: string;
  code: string;
  name: string;
  taxCode: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
  quotes: { id: string; quoteNo: string; status: string; total: number; createdAt: string; createdBy: string }[];
}

export function CustomerInfo({ c }: { c: CustomerDetail }) {
  return (
    <dl className="info">
      <dt>Mã khách hàng</dt>
      <dd>{c.code}</dd>
      <dt>Mã số thuế</dt>
      <dd>{c.taxCode}</dd>
      <dt>Địa chỉ</dt>
      <dd>{c.address}</dd>
      <dt>Người liên hệ</dt>
      <dd>
        {c.contactName} · {c.phone} · {c.email}
      </dd>
    </dl>
  );
}
