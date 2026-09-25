import type { Metadata } from 'next';
import { TopBar } from '@/components/TopBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'An Bình Chemtech · Báo giá',
  description: 'Prototype tạo báo giá tự động',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <TopBar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
