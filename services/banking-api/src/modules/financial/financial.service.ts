import { Injectable } from "@nestjs/common";
import { AccountReceivableStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReceivableDto } from "./dto/create-receivable.dto";

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async createReceivable(tenantId: string, dto: CreateReceivableDto) {
    const total = new Prisma.Decimal(dto.totalAmount);
    return this.prisma.accountReceivable.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        totalAmount: total,
        balanceAmount: total,
        payerDocument: dto.payerDocument,
        linkedPixTxid: dto.linkedPixTxid,
        externalRef: dto.externalRef,
        status: AccountReceivableStatus.OPEN,
      },
    });
  }

  async dashboard(tenantId: string, bankAccountId?: string) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    const txWhere = {
      tenantId,
      deletedAt: null as const,
      bookedAt: { gte: start, lte: end },
      ...(bankAccountId ? { bankAccountId } : {}),
    };

    const [creditsAgg, debitsAgg, pendingRecv, pendingRecon, recent] = await Promise.all([
      this.prisma.bankTransaction.aggregate({
        where: { ...txWhere, direction: "CREDIT" },
        _sum: { amount: true },
      }),
      this.prisma.bankTransaction.aggregate({
        where: { ...txWhere, direction: "DEBIT" },
        _sum: { amount: true },
      }),
      this.prisma.accountReceivable.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: [AccountReceivableStatus.OPEN, AccountReceivableStatus.PARTIALLY_PAID] },
        },
      }),
      this.prisma.financialReconciliation.count({
        where: { tenantId, status: "PENDING", deletedAt: null },
      }),
      this.prisma.bankTransaction.findMany({
        where: { tenantId, deletedAt: null, ...(bankAccountId ? { bankAccountId } : {}) },
        orderBy: { bookedAt: "desc" },
        take: 20,
      }),
    ]);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthly = await this.prisma.bankTransaction.groupBy({
      by: ["direction"],
      where: {
        tenantId,
        deletedAt: null,
        bookedAt: { gte: monthStart },
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      _sum: { amount: true },
    });

    return {
      period: { dayStart: start.toISOString(), dayEnd: end.toISOString() },
      entradasDia: creditsAgg._sum.amount?.toNumber() ?? 0,
      saidasDia: debitsAgg._sum.amount?.toNumber() ?? 0,
      saldoConsultaExtrato: null,
      contasPendentes: pendingRecv,
      conciliacoesPendentes: pendingRecon,
      fluxoMensal: monthly,
      ultimasTransacoes: recent,
    };
  }
}
