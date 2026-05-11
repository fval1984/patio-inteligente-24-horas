import type { BankTransactionDirection, BankTransactionStatus } from "@prisma/client";

export type NormalizedBankTransaction = {
  externalId: string;
  amount: number;
  currency: string;
  description: string | null;
  bookedAt: Date;
  direction: BankTransactionDirection;
  status: BankTransactionStatus;
  payerDocument: string | null;
  payerName: string | null;
  pixTxid: string | null;
  endToEndId: string | null;
  raw: Record<string, unknown>;
};
