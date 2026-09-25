'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Me } from '@/lib/api';

export function TopBar() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (pathname === '/login') return setMe(null);
    api<Me>('/auth/me').then(setMe).catch(() => setMe(null));
  }, [pathname]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <header className="topbar">
      <Link href="/customers">An Bình Chemtech · Hệ thống quản lý nội bộ</Link>
      {me && (
        <div className="user">
          <span>
            {me.name} ({me.role === 'admin' ? 'Admin' : 'Sales'})
          </span>
          <button className="secondary" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      )}
    </header>
  );
}
