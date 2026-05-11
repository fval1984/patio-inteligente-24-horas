import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { BankProviderRegistry } from "../inter-bank/bank-provider.registry";
import { InterBankService } from "../inter-bank/inter-bank.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";

export type SyncMode = "FULL" | "INCREMENTAL" | "MANUAL";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class StatementSyncService {
  private readonly logger = new Logger(StatementSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: BankProviderRegistry,
    private readonly interBank: InterBankService,
    private readonly reconciliation: ReconciliationService
  ) {}

  private resolveRange(
    lastSync: Date | null,
    mode: SyncMode,
    maxDays: number
  ): { dataInicio: string; dataFim: string } {
    const end = new Date();
    const dataFim = ymd(end);
    let start = new Date(end);
    if (mode === "INCREMENTAL" && lastSync) {
      start = new Date(lastSync);
      start.setDate(start.getDate() - 1);
    } else {
      start.setDate(start.getDate() - Math.min(7, maxDays));
    }
    const capStart = new Date(end);
    capStart.setDate(capStart.getDate() - maxDays);
    if (start < capStart) start = capStart;
    return { dataInicio: ymd(start), dataFim };
  }

  async syncBankAccount(bankAccountId: string, tenantId: string, mode: SyncMode, maxDays = 90) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId, deletedAt: null },
    });
    if (!account) throw new NotFoundException("Conta não encontrada.");

    const secrets = await this.interBank.getDecryptedSecrets(bankAccountId, tenantId);
    const credRow = await this.prisma.bankCredential.findUnique({
      where: { bankAccountId },
    });
    const provider = this.registry.resolve(account.provider);
    const token = await provider.obtainToken({
      clientId: secrets.clientId,
      clientSecret: secrets.clientSecret,
      scopes: credRow?.oauthScopes || undefined,
    });

    const range = this.resolveRange(account.lastStatementSyncAt, mode, maxDays);
    const normalized = await provider.fetchStatement(token.accessToken, {
      dataInicio: range.dataInicio,
      dataFim: range.dataFim,
    });

    const rows = normalized.map((t) => ({
      bankAccountId: account.id,
      tenantId: account.tenantId,
      externalId: t.externalId,
      amount: new Prisma.Decimal(t.amount),
      currency: t.currency,
      description: t.description,
      bookedAt: t.bookedAt,
      direction: t.direction,
      status: t.status,
      payerDocument: t.payerDocument,
      payerName: t.payerName,
      pixTxid: t.pixTxid,
      endToEndId: t.endToEndId,
      rawPayload: t.raw as Prisma.InputJsonValue,
    }));

    const res = await this.prisma.bankTransaction.createMany({
      data: rows,
      skipDuplicates: true,
    });

    await this.prisma.bankAccount.update({
      where: { id: account.id },
      data: { lastStatementSyncAt: new Date() },
    });

    const recon = await this.reconciliation.reconcileUnmatchedForAccount(account.id);

    this.logger.log(
      `Sync conta ${bankAccountId}: ${normalized.length} normalizados, ${res.count} novos no banco, conciliações: ${recon.created} criadas / ${recon.autoConfirmed} auto-confirmadas.`
    );

    return {
      range,
      fetched: normalized.length,
      inserted: res.count,
      reconciliation: recon,
    };
  }
}
