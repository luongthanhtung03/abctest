import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, UserAuthGuard } from './auth/auth';
import { PrismaService } from './prisma.service';
import { QuotesService } from './quotes/quotes.service';

/** Customers are visible to all staff; their quote history is filtered by ownership. */
@Controller()
@UseGuards(UserAuthGuard)
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
  ) {}

  @Get('customers')
  customers() {
    return this.prisma.customer.findMany({ orderBy: { code: 'asc' } });
  }

  @Get('customers/:id')
  async customer(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    const quotes = await this.prisma.quote.findMany({
      where: { customerId: id, ...this.quotes.ownershipFilter(user) },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
    return {
      ...customer,
      quotes: quotes.map((q) => ({
        id: q.id,
        quoteNo: q.quoteNo,
        status: q.status,
        total: Number(q.total),
        createdAt: q.createdAt,
        createdBy: q.createdBy.name,
      })),
    };
  }

  @Get('products')
  products() {
    return this.prisma.product.findMany({ orderBy: { sku: 'asc' } });
  }

  @Get('agent-status')
  agentStatus() {
    return this.quotes.agentStatus();
  }
}
