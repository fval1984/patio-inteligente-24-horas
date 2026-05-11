import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  AccountReceivableStatus,
  Prisma,
  ReconciliationMatchType,
  ReconciliationRecordStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { rankMatches, type BankTxSnapshot, type ReceivableSnapshot } from "./reconciliation.engine";

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reconcileUnmatchedForAccount(bankAccountId: string) {
    const txs = await this.prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        reconciled: false,
        deletedAt: null,
        direction: "CREDIT",
      },
      take: 200,
      orderBy: { bookedAt: "desc" },
    });
    let created = 0;
    let autoConfirmed = 0;
    for (const tx of txs) {
      const r = await this.reconcileOneTransaction(tx.id);
      created += r.created;
      autoConfirmed += r.autoConfirmed;
    }
    return { created, autoConfirmed, scanned: txs.length };
  }

  async reconcileOneTransaction(bankTransactionId: string): Promise<{
    created: number;
    autoConfirmed: number;
  }> {
    const tx = await this.prisma.bankTransaction.findUnique({
      where: { id: bankTransactionId },
    });
    if (!tx || tx.reconciled || tx.deletedAt) return { created: 0, autoConfirmed: 0 };

    const already = await this.prisma.financialReconciliation.findFirst({
      where: { bankTransactionId: tx.id, deletedAt: null },
    });
    if (already) return { created: 0, autoConfirmed: 0 };

    const receivables = await this.prisma.accountReceivable.findMany({
      where: {
        tenantId: tx.tenantId,
        status: { in: [AccountReceivableStatus.OPEN, AccountReceivableStatus.PARTIALLY_PAID] },
        deletedAt: null,
      },
    });

    const recSnaps: ReceivableSnapshot[] = receivables.map((r) => ({
      id: r.id,
      totalAmount: r.totalAmount.toNumber(),
      balanceAmount: r.balanceAmount.toNumber(),
      linkedPixTxid: r.linkedPixTxid,
      payerDocument: r.payerDocument,
      description: r.description,
    }));

    const txSnap: BankTxSnapshot = {
      id: tx.id,
      amount: tx.amount.toNumber(),
      pixTxid: tx.pixTxid,
      payerDocument: tx.payerDocument,
      description: tx.description,
    };

    const ranked = rankMatches(txSnap, recSnaps);
    if (!ranked.length || ranked[0].score <= 0) return { created: 0, autoConfirmed: 0 };

    let created = 0;
    let autoConfirmed = 0;

    const top = ranked[0];
    const second = ranked[1]?.score ?? 0;

    const ambiguous = top.score > 0 && second > 0 && top.score - second < 0.05 && top.matchType !== "EXACT";

    const status: ReconciliationRecordStatus =
      top.matchType === "EXACT" && top.score >= 0.99 && !ambiguous
        ? "CONFIRMED"
        : "PENDING";

    const recRow = await this.prisma.financialReconciliation.create({
      data: {
        tenantId: tx.tenantId,
        bankTransactionId: tx.id,
        accountsReceivableId: top.receivableId,
        matchType: top.matchType as ReconciliationMatchType,
        score: new Prisma.Decimal(top.score),
        status,
        rulesMatched: top.rulesMatched,
      },
    });
    created += 1;
    await this.prisma.reconciliationLog.create({
      data: {
        reconciliationId: recRow.id,
        action: "CREATED",
        details: { top, ambiguous },
      },
    });

    if (status === "CONFIRMED") {
      await this.applyConfirmed(tx.tenantId, tx.id, top.receivableId, tx.amount);
      autoConfirmed += 1;
    }

    for (let i = 1; i < Math.min(ranked.length, 4); i++) {
      const c = ranked[i];
      if (c.score <= 0 || c.receivableId === top.receivableId) continue;
      await this.prisma.financialReconciliation.create({
        data: {
          tenantId: tx.tenantId,
          bankTransactionId: tx.id,
          accountsReceivableId: c.receivableId,
          matchType: c.matchType,
          score: new Prisma.Decimal(c.score),
          status: "PENDING",
          rulesMatched: c.rulesMatched,
        },
      });
      created += 1;
    }

    return { created, autoConfirmed };
  }

  private async applyConfirmed(
    tenantId: string,
    bankTransactionId: string,
    receivableId: string,
    paid: Prisma.Decimal
  ) {
    await this.prisma.$transaction(async (db) => {
      const rec = await db.accountReceivable.findFirst({
        where: { id: receivableId, tenantId, deletedAt: null },
      });
      if (!rec) return;
      const newBal = rec.balanceAmount.minus(paid);
      const st =
        newBal.lte(new Prisma.Decimal(0.009))
          ? AccountReceivableStatus.PAID
          : AccountReceivableStatus.PARTIALLY_PAID;
      await db.accountReceivable.update({
        where: { id: receivableId },
        data: {
          balanceAmount: newBal.gt(0) ? newBal : new Prisma.Decimal(0),
          status: st,
        },
      });
      await db.bankTransaction.update({
        where: { id: bankTransactionId },
        data: { reconciled: true },
      });
    });
    this.logger.log(`Baixa automática: tx ${bankTransactionId} → recebível ${receivableId}`);
  }

  async listPending(tenantId: string) {
    return this.prisma.financialReconciliation.findMany({
      where: { tenantId, status: "PENDING", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { bankTransaction: true, accountsReceivable: true },
    });
  }

  async confirm(reconciliationId: string, tenantId: string) {
    const row = await this.prisma.financialReconciliation.findFirst({
      where: { id: reconciliationId, tenantId, deletedAt: null },
      include: { bankTransaction: true },
    });
    if (!row?.bankTransaction || row.status !== "PENDING") {
      return { ok: false as const, reason: "Registro inválido ou já processado." };
    }
    if (!row.bankTransactionId || !row.accountsReceivableId) {
      throw new BadRequestException("Conciliação sem vínculo de transação ou recebível.");
    }
    await this.applyConfirmed(
      tenantId,
      row.bankTransactionId!,
      row.accountsReceivableId!,
      row.bankTransaction.amount
    );
    await this.prisma.financialReconciliation.update({
      where: { id: reconciliationId },
      data: { status: "CONFIRMED" },
    });
    await this.prisma.reconciliationLog.create({
      data: {
        reconciliationId,
        action: "MANUAL_CONFIRM",
        details: {},
      },
    });
    return { ok: true as const };
  }
}
