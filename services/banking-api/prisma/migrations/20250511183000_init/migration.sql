-- CreateEnum
CREATE TYPE "BankProvider" AS ENUM ('INTER', 'NUBANK', 'ITAU', 'OPEN_FINANCE');

-- CreateEnum
CREATE TYPE "BankTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'POSTED', 'REVERSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AccountReceivableStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountPayableStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PixPaymentStatus" AS ENUM ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReconciliationMatchType" AS ENUM ('EXACT', 'PARTIAL', 'POSSIBLE');

-- CreateEnum
CREATE TYPE "ReconciliationRecordStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" "BankProvider" NOT NULL,
    "label" TEXT,
    "external_account_key" TEXT,
    "agency" TEXT,
    "account_number" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "last_statement_sync_at" TIMESTAMP(3),
    "last_incremental_cursor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_credentials" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "encrypted_blob" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "oauth_scopes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "bank_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "description" TEXT,
    "booked_at" TIMESTAMP(3) NOT NULL,
    "direction" "BankTransactionDirection" NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "payer_document" TEXT,
    "payer_name" TEXT,
    "pix_txid" TEXT,
    "end_to_end_id" TEXT,
    "raw_payload" JSONB NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "balance_amount" DECIMAL(18,2) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "AccountReceivableStatus" NOT NULL DEFAULT 'OPEN',
    "payer_document" TEXT,
    "linked_pix_txid" TEXT,
    "external_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "total_amount" DECIMAL(18,2) NOT NULL,
    "balance_amount" DECIMAL(18,2) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "AccountPayableStatus" NOT NULL DEFAULT 'OPEN',
    "beneficiary_document" TEXT,
    "external_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pix_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "status" "PixPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,2),
    "payer_document" TEXT,
    "payer_name" TEXT,
    "end_to_end_id" TEXT,
    "accounts_receivable_id" TEXT,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "pix_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "provider" "BankProvider" NOT NULL,
    "route" TEXT NOT NULL,
    "headers_snapshot" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processing_status" "WebhookProcessingStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_reconciliation" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bank_transaction_id" TEXT,
    "accounts_receivable_id" TEXT,
    "match_type" "ReconciliationMatchType" NOT NULL,
    "score" DECIMAL(5,4) NOT NULL,
    "status" "ReconciliationRecordStatus" NOT NULL DEFAULT 'PENDING',
    "rules_matched" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "financial_reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_logs" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reconciliation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_cashflow" (
    "id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_ymd" TEXT NOT NULL,
    "opening_balance" DECIMAL(18,2) NOT NULL,
    "credits" DECIMAL(18,2) NOT NULL,
    "debits" DECIMAL(18,2) NOT NULL,
    "closing_balance" DECIMAL(18,2) NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "financial_cashflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_credentials_bank_account_id_key" ON "bank_credentials"("bank_account_id");

-- CreateIndex
CREATE INDEX "bank_accounts_tenant_id_provider_deleted_at_idx" ON "bank_accounts"("tenant_id", "provider", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_bank_account_id_external_id_key" ON "bank_transactions"("bank_account_id", "external_id");

-- CreateIndex
CREATE INDEX "bank_transactions_tenant_id_booked_at_idx" ON "bank_transactions"("tenant_id", "booked_at");

-- CreateIndex
CREATE INDEX "bank_transactions_pix_txid_idx" ON "bank_transactions"("pix_txid");

-- CreateIndex
CREATE INDEX "bank_transactions_payer_document_idx" ON "bank_transactions"("payer_document");

-- CreateIndex
CREATE INDEX "accounts_receivable_tenant_id_status_idx" ON "accounts_receivable"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "accounts_receivable_linked_pix_txid_idx" ON "accounts_receivable"("linked_pix_txid");

-- CreateIndex
CREATE INDEX "accounts_payable_tenant_id_status_idx" ON "accounts_payable"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pix_payments_tenant_id_txid_key" ON "pix_payments"("tenant_id", "txid");

-- CreateIndex
CREATE INDEX "pix_payments_end_to_end_id_idx" ON "pix_payments"("end_to_end_id");

-- CreateIndex
CREATE INDEX "webhook_logs_provider_created_at_idx" ON "webhook_logs"("provider", "created_at");

-- CreateIndex
CREATE INDEX "financial_reconciliation_tenant_id_status_idx" ON "financial_reconciliation"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "financial_reconciliation_bank_transaction_id_idx" ON "financial_reconciliation"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "reconciliation_logs_reconciliation_id_created_at_idx" ON "reconciliation_logs"("reconciliation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_cashflow_bank_account_id_period_ymd_key" ON "financial_cashflow"("bank_account_id", "period_ymd");

-- CreateIndex
CREATE INDEX "financial_cashflow_tenant_id_period_ymd_idx" ON "financial_cashflow"("tenant_id", "period_ymd");

-- AddForeignKey
ALTER TABLE "bank_credentials" ADD CONSTRAINT "bank_credentials_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_payments" ADD CONSTRAINT "pix_payments_accounts_receivable_id_fkey" FOREIGN KEY ("accounts_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliation" ADD CONSTRAINT "financial_reconciliation_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliation" ADD CONSTRAINT "financial_reconciliation_accounts_receivable_id_fkey" FOREIGN KEY ("accounts_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_logs" ADD CONSTRAINT "reconciliation_logs_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "financial_reconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_cashflow" ADD CONSTRAINT "financial_cashflow_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
