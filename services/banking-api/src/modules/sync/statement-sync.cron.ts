import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { StatementSyncService } from "./statement-sync.service";

@Injectable()
export class StatementSyncCron {
  private readonly logger = new Logger(StatementSyncCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: StatementSyncService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailySync() {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { deletedAt: null, isActive: true },
    });
    for (const a of accounts) {
      try {
        await this.sync.syncBankAccount(a.id, a.tenantId, "INCREMENTAL");
      } catch (e) {
        this.logger.error(
          `Falha sync diário conta ${a.id}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
  }
}
