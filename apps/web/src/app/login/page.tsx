'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';

const DEMO_ACCOUNTS = [
  { email: 'sales.a@anbinh.test', label: 'Sales A (Nguyễn Văn An)' },
  { email: 'sales.b@anbinh.test', label: 'Sales B (Trần Thị Bình)' },
  { email: 'admin@anbinh.test', label: 'Admin (Lê Quản Lý)' },
];

export default function LoginPage() {
  const [email, setEmail] = useState(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      window.location.href = '/customers';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được máy chủ');
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }}>
      <form className="card" onSubmit={submit}>
        <h1>Đăng nhập</h1>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>Mật khẩu</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <div className="alert error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>

      <div className="card">
        <h2>Tài khoản demo (mật khẩu: 123456)</h2>
        {DEMO_ACCOUNTS.map((a) => (
          <div key={a.email}>
            <a href="#" onClick={(e) => { e.preventDefault(); setEmail(a.email); setPassword('123456'); }}>
              {a.label}
            </a>{' '}
            <span className="muted">— {a.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
