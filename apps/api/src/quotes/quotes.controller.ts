import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { createQuoteSchema, QuoteStatus } from '@abc/shared';
import { Response } from 'express';
import { AuthUser, CurrentUser, UserAuthGuard } from '../auth/auth';
import { parseOrThrow } from '../common/validation';
import { PrismaService } from '../prisma.service';
import { FileStorage } from '../storage/file-storage';
import { QuotesService } from './quotes.service';

@Controller('quotes')
@UseGuards(UserAuthGuard)
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
  ) {}

  @Post()
  async create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new BadRequestException('Thiếu header Idempotency-Key');
    }
    const input = parseOrThrow(createQuoteSchema, body);
    const { quote, created } = await this.quotes.create(input, idempotencyKey, user);
    res.status(created ? 201 : 200);
    return { id: quote.id, quoteNo: quote.quoteNo, status: quote.status, duplicate: !created };
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const q = await this.quotes.findVisible(id, user);
    const [events, agent, createdBy] = await Promise.all([
      this.prisma.quoteEvent.findMany({ where: { quoteId: id }, orderBy: { createdAt: 'asc' } }),
      this.quotes.agentStatus(),
      this.prisma.user.findUnique({ where: { id: q.createdById }, select: { name: true } }),
    ]);
    return {
      id: q.id,
      quoteNo: q.quoteNo,
      customerId: q.customerId,
      status: q.status,
      total: Number(q.total),
      attempts: q.attempts,
      errorCode: q.errorCode,
      errorMessage: q.errorMessage,
      hasFile: !!q.fileKey,
      createdBy: createdBy?.name,
      createdAt: q.createdAt,
      completedAt: q.completedAt,
      payload: q.payload,
      events,
      agent,
    };
  }

  @Get(':id/file')
  async file(@Param('id') id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const q = await this.quotes.findVisible(id, user); // ownership check → 404 for others
    if (q.status !== QuoteStatus.COMPLETED || !q.fileKey) throw new NotFoundException('File chưa sẵn sàng');
    const data = await this.storage.read(q.fileKey);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${q.quoteNo}.docx"`,
    });
    res.send(data);
  }

  @Post(':id/retry')
  @HttpCode(200)
  async retry(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.quotes.retry(id, user);
    return { ok: true };
  }
}
