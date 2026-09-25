import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Quote } from '@prisma/client';
import { computeTotals, CreateQuoteInput, JobPayload, MAX_ATTEMPTS, QuoteStatus } from '@abc/shared';
import { randomUUID } from 'crypto';
import { AuthUser } from '../auth/auth';
import { config } from '../config';
import { PrismaService } from '../prisma.service';
import { FileStorage } from '../storage/file-storage';

/** The stored snapshot = JobPayload minus per-attempt fields (added at claim time). */
type Snapshot = Omit<JobPayload, 'jobId' | 'attempt'>;

@Injectable()
export class QuotesService {
  private readonly log = new Logger('Quotes');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
  ) {}

  // ---------- user side ----------

  /** Sales only see their own quotes; admin sees all (docs/09). */
  ownershipFilter(user: AuthUser): Prisma.QuoteWhereInput {
    return user.role === 'admin' ? {} : { createdById: user.id };
  }

  /** Returns 404 (not 403) for quotes the user may not see, so IDs can't be probed. */
  async findVisible(id: string, user: AuthUser): Promise<Quote> {
    const quote = await this.prisma.quote.findFirst({ where: { id, ...this.ownershipFilter(user) } });
    if (!quote) throw new NotFoundException('Không tìm thấy báo giá');
    return quote;
  }

  /**
   * Creates a quote as PENDING. Idempotent on `idempotencyKey`:
   * a repeated submit returns the existing quote instead of creating a new one (docs/08).
   */
  async create(input: CreateQuoteInput, idempotencyKey: string, user: AuthUser) {
    const existing = await this.prisma.quote.findUnique({ where: { idempotencyKey } });
    if (existing) return { quote: this.ensureSameOwner(existing, user), created: false };

    const customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    const missing = input.items.findIndex((i) => !byId.has(i.productId));
    if (missing >= 0) {
      throw new BadRequestException({
        message: 'Dữ liệu không hợp lệ',
        errors: [{ field: `items.${missing}.productId`, message: 'Sản phẩm không tồn tại' }],
      });
    }

    // Totals are recalculated here; client-side totals are never trusted.
    const totals = computeTotals(input.items, input.vatRate);
    const now = new Date();
    const validUntil = new Date(now.getTime() + input.validityDays * 86_400_000);

    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('quotes', 'seq'))`;
    const seq = Number(nextval);
    const quoteNo = `BG-${now.getFullYear()}-${String(seq).padStart(4, '0')}`;

    // Frozen snapshot: later changes to customer/product/template don't affect this quote.
    const snapshot: Snapshot = {
      quoteNo,
      templateVersion: config.currentTemplateVersion,
      createdAt: now.toISOString(),
      salesperson: { name: user.name, email: user.email },
      customer: {
        code: customer.code,
        name: customer.name,
        taxCode: customer.taxCode,
        address: customer.address,
        contactName: customer.contactName,
        phone: customer.phone,
        email: customer.email,
      },
      items: input.items.map((i, idx) => {
        const p = byId.get(i.productId)!;
        return {
          sku: p.sku,
          name: p.name,
          spec: p.spec,
          unit: p.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: totals.lineTotals[idx],
        };
      }),
      vatRate: input.vatRate,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      validUntil: validUntil.toISOString().slice(0, 10),
      notes: input.notes,
    };

    const id = randomUUID();
    try {
      const quote = await this.prisma.$transaction(async (tx) => {
        const q = await tx.quote.create({
          data: {
            id,
            seq,
            quoteNo,
            customerId: customer.id,
            createdById: user.id,
            status: QuoteStatus.PENDING,
            idempotencyKey,
            templateVersion: snapshot.templateVersion,
            payload: snapshot as unknown as Prisma.InputJsonValue,
            total: BigInt(totals.total),
          },
        });
        await tx.quoteEvent.create({
          data: {
            quoteId: id,
            type: 'CREATED',
            toStatus: QuoteStatus.PENDING,
            actor: `user:${user.id}`,
            message: `${user.name} gửi yêu cầu tạo báo giá`,
          },
        });
        return q;
      });
      this.log.log(`[quote=${id}] created ${quoteNo}`);
      return { quote, created: true };
    } catch (e) {
      // Two concurrent submits with the same key: the UNIQUE constraint decides, the loser returns the winner.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.quote.findUnique({ where: { idempotencyKey } });
        if (winner) return { quote: this.ensureSameOwner(winner, user), created: false };
      }
      throw e;
    }
  }

  /** A key reused by another user must not reveal that user's quote. */
  private ensureSameOwner(quote: Quote, user: AuthUser): Quote {
    if (quote.createdById !== user.id) throw new ConflictException('Idempotency-Key đã được sử dụng');
    return quote;
  }

  async retry(id: string, user: AuthUser) {
    const quote = await this.findVisible(id, user);
    if (quote.status !== QuoteStatus.FAILED) throw new ConflictException('Chỉ báo giá Lỗi mới được thử lại');
    await this.prisma.$transaction([
      this.prisma.quote.update({
        where: { id },
        data: { status: QuoteStatus.PENDING, attempts: 0, nextRunAt: new Date(), errorCode: null, errorMessage: null },
      }),
      this.prisma.quoteEvent.create({
        data: {
          quoteId: id,
          type: 'RETRY_REQUESTED',
          fromStatus: QuoteStatus.FAILED,
          toStatus: QuoteStatus.PENDING,
          actor: `user:${user.id}`,
          message: `${user.name} yêu cầu thử lại`,
        },
      }),
    ]);
    this.log.log(`[quote=${id}] manual retry by user ${user.id}`);
  }

  async agentStatus() {
    const latest = await this.prisma.agent.findFirst({ orderBy: { lastSeenAt: 'desc' } });
    const lastSeenAt = latest?.lastSeenAt ?? null;
    const online = !!lastSeenAt && Date.now() - lastSeenAt.getTime() < config.agentOfflineAfterMs;
    return { online, lastSeenAt };
  }

  // ---------- agent side ----------

  /**
   * Atomically claims the oldest due PENDING quote (docs/05).
   * FOR UPDATE SKIP LOCKED: two agents can never get the same job.
   */
  async claim(agentId: string): Promise<JobPayload | null> {
    await this.prisma.agent.upsert({
      where: { id: agentId },
      update: { lastSeenAt: new Date() },
      create: { id: agentId, lastSeenAt: new Date() },
    });

    const rows = await this.prisma.$queryRaw<{ id: string; payload: Snapshot; attempts: number }[]>`
      UPDATE quotes
      SET status = 'PROCESSING', locked_by = ${agentId},
          locked_until = now() + interval '5 minutes',
          attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM quotes
        WHERE status = 'PENDING' AND next_run_at <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, payload, attempts`;
    if (rows.length === 0) return null;

    const { id, payload, attempts } = rows[0];
    await this.prisma.quoteEvent.create({
      data: {
        quoteId: id,
        type: 'CLAIMED',
        fromStatus: QuoteStatus.PENDING,
        toStatus: QuoteStatus.PROCESSING,
        actor: `agent:${agentId}`,
        message: `Mac mini bắt đầu xử lý (lần ${attempts}/${MAX_ATTEMPTS})`,
      },
    });
    this.log.log(`[quote=${id} attempt=${attempts}] claimed by ${agentId}`);
    return { ...payload, jobId: id, attempt: attempts };
  }

  /** Only the agent currently holding the job may report on it (rejects stale agents). */
  private async findHeldJob(id: string, agentId: string): Promise<Quote> {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Job not found');
    if (quote.status !== QuoteStatus.PROCESSING || quote.lockedBy !== agentId) {
      throw new ConflictException(`Job is ${quote.status}, not held by ${agentId}`);
    }
    return quote;
  }

  /** Save file first, then mark COMPLETED: the DB never says COMPLETED without a file (docs/04). */
  async complete(id: string, agentId: string, file: Buffer) {
    const current = await this.prisma.quote.findUnique({ where: { id } });
    if (current?.status === QuoteStatus.COMPLETED) return { alreadyCompleted: true }; // idempotent repeat
    const quote = await this.findHeldJob(id, agentId);

    // Deterministic key: a retry after a crash overwrites any orphan from the previous attempt.
    const key = `quotes/${quote.quoteNo.split('-')[1]}/${quote.quoteNo}.docx`;
    await this.storage.save(key, file);

    await this.prisma.$transaction([
      this.prisma.quote.update({
        where: { id },
        data: {
          status: QuoteStatus.COMPLETED,
          fileKey: key,
          fileSize: file.length,
          completedAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          errorCode: null,
          errorMessage: null,
        },
      }),
      this.prisma.quoteEvent.create({
        data: {
          quoteId: id,
          type: 'COMPLETED',
          fromStatus: QuoteStatus.PROCESSING,
          toStatus: QuoteStatus.COMPLETED,
          actor: `agent:${agentId}`,
          message: `Đã tạo file báo giá (${Math.round(file.length / 1024)} KB)`,
        },
      }),
    ]);
    this.log.log(`[quote=${id} attempt=${quote.attempts}] completed, stored at ${key}`);
    return { alreadyCompleted: false };
  }

  async fail(id: string, agentId: string, report: { code: string; message: string; retryable: boolean }) {
    const quote = await this.findHeldJob(id, agentId);
    const willRetry = report.retryable && quote.attempts < MAX_ATTEMPTS;
    const toStatus = willRetry ? QuoteStatus.PENDING : QuoteStatus.FAILED;

    await this.prisma.$transaction([
      this.prisma.quote.update({
        where: { id },
        data: {
          status: toStatus,
          lockedBy: null,
          lockedUntil: null,
          nextRunAt: new Date(),
          errorCode: report.code,
          errorMessage: report.message,
        },
      }),
      this.prisma.quoteEvent.create({
        data: {
          quoteId: id,
          type: willRetry ? 'RETRY_SCHEDULED' : 'FAILED',
          fromStatus: QuoteStatus.PROCESSING,
          toStatus,
          actor: `agent:${agentId}`,
          message: willRetry
            ? `Lỗi ${report.code}: ${report.message}. Sẽ thử lại (${quote.attempts}/${MAX_ATTEMPTS})`
            : `Lỗi ${report.code}: ${report.message}`,
        },
      }),
    ]);
    this.log.warn(`[quote=${id} attempt=${quote.attempts}] failed ${report.code} → ${toStatus}`);
  }

  /** Informational timeline entries from the agent (e.g. AI fallback, AI warnings). */
  async addAgentEvent(id: string, agentId: string, type: string, message: string) {
    await this.findHeldJob(id, agentId);
    await this.prisma.quoteEvent.create({
      data: { quoteId: id, type: type.slice(0, 40), actor: `agent:${agentId}`, message: message.slice(0, 1000) },
    });
  }
}
