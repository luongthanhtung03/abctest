import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// All data is fictional (test brief §9).
async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);

  const users = [
    { email: 'sales.a@anbinh.test', name: 'Nguyễn Văn An', role: 'sales' },
    { email: 'sales.b@anbinh.test', name: 'Trần Thị Bình', role: 'sales' },
    { email: 'admin@anbinh.test', name: 'Lê Quản Lý', role: 'admin' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  if ((await prisma.customer.count()) === 0) {
    await prisma.customer.createMany({
      data: [
        {
          code: 'KH001',
          name: 'Công ty TNHH Hóa chất Minh Phát',
          taxCode: '0312345678',
          address: 'Lô B5, KCN Tân Bình, TP. Hồ Chí Minh',
          contactName: 'Phạm Minh Tuấn',
          phone: '0901234567',
          email: 'tuan.pm@minhphat.test',
        },
        {
          code: 'KH002',
          name: 'Công ty CP Dệt nhuộm Thành Công',
          taxCode: '0309876543',
          address: '36 Tây Thạnh, Q. Tân Phú, TP. Hồ Chí Minh',
          contactName: 'Võ Thị Hoa',
          phone: '0912345678',
          email: 'hoa.vt@thanhcong.test',
        },
        {
          code: 'KH003',
          name: 'Nhà máy Xử lý nước Bình Dương',
          taxCode: '3701122334',
          address: 'KCN VSIP 1, Thuận An, Bình Dương',
          contactName: 'Đặng Quốc Việt',
          phone: '0987654321',
          email: 'viet.dq@nuocbd.test',
        },
      ],
    });
  }

  if ((await prisma.product.count()) === 0) {
    await prisma.product.createMany({
      data: [
        { sku: 'NAOH-99', name: 'Xút vảy NaOH 99%', spec: 'Bao 25kg', unit: 'kg', listPrice: 12500 },
        { sku: 'HCL-32', name: 'Axit Clohydric HCl 32%', spec: 'Can 30kg', unit: 'kg', listPrice: 4200 },
        { sku: 'H2SO4-98', name: 'Axit Sunfuric H2SO4 98%', spec: 'Can 35kg', unit: 'kg', listPrice: 5800 },
        { sku: 'PAC-31', name: 'PAC 31% (Poly Aluminium Chloride)', spec: 'Bao 25kg', unit: 'kg', listPrice: 9800 },
        { sku: 'H2O2-50', name: 'Oxy già H2O2 50%', spec: 'Can 30kg', unit: 'kg', listPrice: 11000 },
        { sku: 'NACLO-10', name: 'Javen NaClO 10%', spec: 'Can 30kg', unit: 'kg', listPrice: 3500 },
      ],
    });
  }

  console.log('Seed done: 3 users (password 123456), 3 customers, 6 products');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
