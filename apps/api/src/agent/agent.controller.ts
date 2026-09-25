import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { agentFailSchema } from '@abc/shared';
import { Response } from 'express';
import { AgentKeyGuard, CurrentAgent } from '../auth/auth';
import { parseOrThrow } from '../common/validation';
import { QuotesService } from '../quotes/quotes.service';

/** Endpoints for the Mac mini agent (pull model, docs/03–05). Agent key only. */
@Controller('agent/jobs')
@UseGuards(AgentKeyGuard)
export class AgentController {
  constructor(private readonly quotes: QuotesService) {}

  /** 200 + job payload, or 204 when there is nothing to do. Also records agent last-seen. */
  @Post('claim')
  async claim(@CurrentAgent() agentId: string, @Res({ passthrough: true }) res: Response) {
    const job = await this.quotes.claim(agentId);
    if (!job) {
      res.status(204);
      return;
    }
    res.status(200);
    return job;
  }

  @Post(':id/complete')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async complete(
    @Param('id') id: string,
    @CurrentAgent() agentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Missing file');
    return this.quotes.complete(id, agentId, file.buffer);
  }

  @Post(':id/fail')
  @HttpCode(200)
  async fail(@Param('id') id: string, @CurrentAgent() agentId: string, @Body() body: unknown) {
    await this.quotes.fail(id, agentId, parseOrThrow(agentFailSchema, body));
    return { ok: true };
  }

  @Post(':id/events')
  @HttpCode(200)
  async event(
    @Param('id') id: string,
    @CurrentAgent() agentId: string,
    @Body() body: { type?: string; message?: string },
  ) {
    await this.quotes.addAgentEvent(id, agentId, String(body.type ?? 'INFO'), String(body.message ?? ''));
    return { ok: true };
  }
}
