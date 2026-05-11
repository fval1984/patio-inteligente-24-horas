import { Module } from "@nestjs/common";
import { InterBankModule } from "../inter-bank/inter-bank.module";
import { ReconciliationModule } from "../reconciliation/reconciliation.module";
import { StatementSyncCron } from "./statement-sync.cron";
import { StatementSyncService } from "./statement-sync.service";
import { SyncController } from "./sync.controller";

@Module({
  imports: [InterBankModule, ReconciliationModule],
  controllers: [SyncController],
  providers: [StatementSyncService, StatementSyncCron],
  exports: [StatementSyncService],
})
export class SyncModule {}
