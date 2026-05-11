import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { AuthModule } from "./modules/auth/auth.module";
import { FinancialModule } from "./modules/financial/financial.module";
import { InterBankModule } from "./modules/inter-bank/inter-bank.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ReconciliationModule } from "./modules/reconciliation/reconciliation.module";
import { SyncModule } from "./modules/sync/sync.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || "dev-only-change-me",
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || "8h" },
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: Number(process.env.RATE_LIMIT_TTL_MS || 60_000),
        limit: Number(process.env.RATE_LIMIT_MAX || 120),
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    InterBankModule,
    FinancialModule,
    ReconciliationModule,
    WebhooksModule,
    SyncModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
