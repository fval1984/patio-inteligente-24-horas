import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccountReceivableStatus,
  BankProvider,
  Prisma,
  WebhookProcessingStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function deepFindTxid(obj: unknown): string | undefined {
  if (!isRecord(obj)) return undefined;
  if (typeof obj.txid === "string" && obj.txid) return obj.txid;
  for (const v of Object.values(obj)) {
    const x = deepFindTxid(v);
    if (x) return x;
  }
  return undefined;
}

function deepFindAmount(obj: unknown): number | undefined {
  if (!isRecord(obj)) return undefined;
  const keys = ["valor", "amount", "original", "value"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (isRecord(v) && typeof v.valor === "string") {
      const n = Number(v.valor);
      if (Number.isFinite(n)) return n;
    }
  }
  for (const v of Object.values(obj)) {
    const x = deepFindAmount(v);
    if (x !== undefined) return x;
  }
  return undefined;
}

function deepFindDoc(obj: unknown): string | undefined {
  if (!isRecord(obj)) return undefined;
  const keys = ["cpf", "cnpj", "cnpjCpf", "cpfCnpj", "documento"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v) return v;
  }
  for (const v of Object.values(obj)) {
    const x = deepFindDoc(v);
    if (x) return x;
  }
  return undefined;
}

@Injectable()
export class InterPixWebhookService {
  private readonly logger = new Logger(InterPixWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationService,
    private readonly config: ConfigService
  ) {}

  async handle(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
    body: unknown,
    opts?: { tenantHeader?: string }
  ): Promise<{ ok: boolean; txid?: string; message?: string }> {
    const bodyJson = (body ?? JSON.parse(rawBody.toString("utf8"))) as Record<string, unknown>;
    const log = await this.prisma.webhookLog.create({
      data: {
        provider: BankProvider.INTER,
        route: "/webhooks/inter/pix",
        headersSnapshot: headers as object,
        body: bodyJson as object,
        signatureValid: true,
        processingStatus: WebhookProcessingStatus.RECEIVED,
      },
    });

    try {
      const txid = deepFindTxid(bodyJson);
      const amount = deepFindAmount(bodyJson);
      const payerDocument = deepFindDoc(bodyJson);
      if (!txid) {
        await this.prisma.webhookLog.update({
          where: { id: log.id },
          data: {
            processingStatus: WebhookProcessingStatus.FAILED,
            errorMessage: "txid não localizado no payload",
            processedAt: new Date(),
          },
        });
        return { ok: false, message: "txid ausente" };
      }

      const receivable = await this.prisma.accountReceivable.findFirst({
        where: {
          linkedPixTxid: txid,
          deletedAt: null,
          status: { in: [AccountReceivableStatus.OPEN, AccountReceivableStatus.PARTIALLY_PAID] },
        },
      });

      const tenantId =
        receivable?.tenantId ||
        opts?.tenantHeader ||
        this.config.get<string>("webhooks.defaultTenantId") ||
        null;

      if (tenantId) {
        await this.prisma.pixPayment.upsert({
          where: { tenantId_txid: { tenantId, txid } },
          create: {
            tenantId,
            txid,
            status: "CONFIRMED",
            amount: amount !== undefined ? new Prisma.Decimal(amount) : null,
            payerDocument: payerDocument ?? null,
            rawPayload: bodyJson as object,
            accountsReceivableId: receivable?.id,
          },
          update: {
            status: "CONFIRMED",
            amount: amount !== undefined ? new Prisma.Decimal(amount) : undefined,
            payerDocument: payerDocument ?? undefined,
            rawPayload: bodyJson as object,
            accountsReceivableId: receivable?.id ?? undefined,
          },
        });
      }

      if (receivable && amount !== undefined) {
        const paid = new Prisma.Decimal(amount);
        await this.prisma.$transaction(async (db) => {
          const fresh = await db.accountReceivable.findUnique({ where: { id: receivable.id } });
          if (!fresh) return;
          const newBal = fresh.balanceAmount.minus(paid);
          const st =
            newBal.lte(new Prisma.Decimal(0.009))
              ? AccountReceivableStatus.PAID
              : AccountReceivableStatus.PARTIALLY_PAID;
          await db.accountReceivable.update({
            where: { id: fresh.id },
            data: {
              balanceAmount: newBal.gt(0) ? newBal : new Prisma.Decimal(0),
              status: st,
            },
          });
        });
        this.logger.log(`PIX ${txid}: baixa em conta a receber ${receivable.id}`);
      } else if (!tenantId) {
        this.logger.warn(
          `Webhook PIX ${txid}: sem tenant (defina WEBHOOK_DEFAULT_TENANT_ID ou cabeçalho x-tenant-id, ou vincule cobrança).`
        );
      }

      const orphanTx = await this.prisma.bankTransaction.findFirst({
        where: { pixTxid: txid, deletedAt: null, reconciled: false },
      });
      if (orphanTx) {
        await this.reconciliation.reconcileOneTransaction(orphanTx.id);
      }

      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: { processingStatus: WebhookProcessingStatus.PROCESSED, processedAt: new Date() },
      });
      return { ok: true, txid };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          processingStatus: WebhookProcessingStatus.FAILED,
          errorMessage: msg,
          processedAt: new Date(),
        },
      });
      throw e;
    }
  }
}
