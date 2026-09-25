import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgentController } from './agent/agent.controller';
import { AgentKeyGuard, UserAuthGuard } from './auth/auth';
import { AuthController } from './auth/auth.controller';
import { CatalogController } from './catalog.controller';
import { config } from './config';
import { PrismaService } from './prisma.service';
import { QuotesController } from './quotes/quotes.controller';
import { QuotesService } from './quotes/quotes.service';
import { FileStorage, LocalFileStorage } from './storage/file-storage';

@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret, signOptions: { expiresIn: '8h' } })],
  controllers: [AuthController, CatalogController, QuotesController, AgentController],
  providers: [
    PrismaService,
    QuotesService,
    UserAuthGuard,
    AgentKeyGuard,
    // STORAGE_DRIVER=s3 would bind an S3FileStorage here instead (docs/11).
    { provide: FileStorage, useClass: LocalFileStorage },
  ],
})
export class AppModule {}
