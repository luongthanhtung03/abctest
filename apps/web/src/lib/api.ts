'use client';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
  }
}

/** fetch wrapper: same-origin /api (proxied to NestJS); 401 sends the user to /login. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    window.location.href = '/login';
    throw new ApiError(401, 'Chưa đăng nhập');
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? `Lỗi ${res.status}`;
    throw new ApiError(res.status, msg, body?.errors ?? []);
  }
  return body as T;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  role: 'sales' | 'admin';
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  FAILED: 'Lỗi',
};

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('vi-VN', { hour12: false });
}
