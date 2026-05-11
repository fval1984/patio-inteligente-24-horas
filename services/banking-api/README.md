# Banking API — Integração oficial Banco Inter

Serviço **NestJS + Prisma + PostgreSQL** separado do frontend Next.js do monólito `amplipatio`, focado em:

- OAuth2 **client_credentials** com **mTLS** (certificado PJ Inter)
- Sincronização de **extrato** (`/banking/v2/extrato/completo` configurável)
- **Webhook PIX** com validação de assinatura (HMAC configurável; alinhar ao manual oficial de callback)
- **Conciliação** automática (txid, valor, documento, descrição) e confirmação manual
- **Dashboard** agregado (entradas/saídas do dia, pendências, fluxo mensal)
- Extensão futura **multi-banco** via interface `BankProviderPort`

Documentação interativa: `http://localhost:3001/docs` (Swagger).

## Arquitetura de pastas

```
src/
  core/banking/          # Contratos (BankProviderPort, tipos normalizados)
  common/                # Criptografia AES-256-GCM, circuit breaker, retries
  config/                # Configuração + validação de env
  modules/
    prisma/              # PrismaService global
    auth/                # JWT (Passport) + endpoint dev de token
    inter-bank/          # mTLS, OAuth Inter, provider + registro de conta
    financial/           # Contas a receber + dashboard
    reconciliation/      # Motor + persistência financial_reconciliation
    webhooks/            # POST /webhooks/inter/pix
    sync/                # Sync manual + cron diário (6h)
```

## Pré-requisitos

- Node.js 20+
- PostgreSQL 16+
- Certificado **mTLS** emitido pelo Inter (PFX ou par `.crt` + `.key`)
- Credenciais **Client ID** e **Client Secret** da integração PJ

## Configuração rápida

```bash
cd services/banking-api
cp .env.example .env
# Ajuste DATABASE_URL, JWT_SECRET, CREDENTIALS_MASTER_KEY_HEX (64 hex),
# caminhos INTER_MTLS_* e segredos de webhook.

npm install
npx prisma migrate deploy   # ou: npx prisma migrate dev
npm run start:dev
```

### Chave de criptografia (credenciais em repouso)

Gere 32 bytes em hex (64 caracteres), por exemplo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Certificado mTLS (passo a passo resumido)

1. No Internet Banking PJ: **Soluções para sua empresa → Nova integração**.
2. Aceite os escopos necessários (mínimo sugerido no `.env.example`: `extrato.read`, `cob.read`, webhooks conforme uso).
3. Baixe o certificado e a chave API; ative o certificado na área de integrações.
4. Coloque o **PFX** (ou `.crt` + `.key`) em um diretório seguro; monte no Docker (`./secrets:/secrets`) e aponte:
   - `INTER_MTLS_PFX_PATH` **ou**
   - `INTER_MTLS_CERT_PATH` + `INTER_MTLS_KEY_PATH`
5. Sandbox: use as URLs UAT indicadas no [portal do desenvolvedor Inter](https://developers.inter.co/) (`INTER_OAUTH_BASE_URL`, `INTER_API_BASE_URL`).

Não utilize scraping nem automação do internet banking — apenas as APIs documentadas.

## Fluxo OAuth + extrato

1. `InterMtlsAgentFactory` monta `https.Agent` com PFX ou cert/key.
2. `InterOAuthService` chama `POST /oauth/v2/token` com `grant_type=client_credentials`, reutiliza token até próximo do `expires_in`.
3. `InterBankProvider.fetchStatement` chama o path configurável (default extrato completo), pagina até esgotar lote.
4. `StatementSyncService` grava em `bank_transactions` com `skipDuplicates` pela chave `(bank_account_id, external_id)`.
5. Em seguida executa conciliação para créditos não reconciliados.

## Webhook PIX

- Rota: **`POST /webhooks/inter/pix`**
- Corpo: JSON enviado pelo Inter (estrutura varia por produto/callback — o serviço faz busca recursiva de `txid` e `valor`).
- Assinatura (modo configurável neste projeto): **HMAC-SHA256** do **corpo bruto** comparado em hex com o cabeçalho `INTER_WEBHOOK_SIGNATURE_HEADER` (default `x-inter-signature`).
- **Importante:** confirme no manual oficial do Inter o algoritmo e o cabeçalho exatos; ajuste o `InterWebhookSignatureGuard` se o banco usar outro esquema.
- Desenvolvimento: `INTER_WEBHOOK_SKIP_VERIFY=true` desliga a verificação (nunca em produção).

### Exemplo de requisição (teste local com assinatura)

```bash
# PowerShell (Windows)
$body = '{"pix":[{"txid":"MEUTXID123","valor":"150.00"}]}'
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes("SEU_SEGREDO"))
$sig = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") })
Invoke-RestMethod -Method Post -Uri http://localhost:3001/webhooks/inter/pix `
  -ContentType "application/json" -Headers @{ "x-inter-signature" = $sig } -Body $body
```

Substitua `SEU_SEGREDO` por `INTER_WEBHOOK_HMAC_SECRET`. Em Linux/macOS, equivalente com `openssl dgst -sha256 -hmac`.

### Multi-tenant no webhook

1. Preferencial: exista `accounts_receivable.linked_pix_txid` igual ao `txid` — o tenant é inferido.
2. Alternativa: cabeçalho **`x-tenant-id`**.
3. Alternativa: `WEBHOOK_DEFAULT_TENANT_ID` no `.env`.

## Conciliação

- Tabela principal: `financial_reconciliation` (+ `reconciliation_logs`).
- Regras implementadas em `reconciliation.engine.ts`:
  - **EXACT**: `txid` PIX igual ao `linked_pix_txid` do recebível, ou combinação forte valor+documento.
  - **PARTIAL** / **POSSIBLE**: pontuação por documento, valor e similaridade de descrição.
- Match **EXACT** com alta confiança gera **baixa automática** em `accounts_receivable` e marca `bank_transactions.reconciled`.
- API: `GET /reconciliation/pending`, `POST /reconciliation/:id/confirm` (JWT).

## JWT (chamadas autenticadas)

Endpoints protegidos usam `Authorization: Bearer <token>` com payload `{ "sub": "<tenantId>" }`.

Em desenvolvimento, com `DEV_JWT_ENDPOINT=true`:

```bash
curl -sS -X POST http://localhost:3001/auth/dev/token \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"tenant-demo"}'
```

## Exemplos de fluxo REST

1. Registrar conta Inter (credenciais são persistidas cifradas):

`POST /inter-bank/accounts` com `{ "clientId", "clientSecret", "label", "oauthScopes?" }`

2. Sincronizar extrato:

`POST /sync/statements/{bankAccountId}` com `{ "mode": "MANUAL" | "INCREMENTAL" | "FULL" }`

3. Saldo na data:

`GET /inter-bank/accounts/{id}/balance?dataSaldo=2026-05-11`

4. Criar conta a receber com vínculo PIX:

`POST /financial/receivables` com `{ "totalAmount": 150, "linkedPixTxid": "MEUTXID123" }`

5. Dashboard:

`GET /financial/dashboard/summary?bankAccountId=...`

## Docker

```bash
cd services/banking-api
cp .env.example .env
docker compose up --build
```

PostgreSQL exposto em `localhost:5433` (mapeado no `docker-compose.yml`). Ajuste `DATABASE_URL` no `.env` local se for rodar fora do Compose.

## Testes

```bash
npm test
```

## Integração com o app Next.js existente

- Opção A: este serviço exposto na mesma rede/VPC; o Next chama REST com JWT emitido pelo teu IdP.
- Opção B: consolidar autenticação (ex.: mesmo segredo JWT assinado pelo backend principal).
- Opcional: fila (SQS/Rabbit) para processar webhooks com idempotência adicional.

## Próximos passos sugeridos

- Persistir **fluxo de caixa** agregado em `financial_cashflow` (job pós-sync).
- Idempotência de webhook por `txid` + `endToEndId` com lock distribuído.
- Conector **Nubank / Itaú / Open Finance** implementando `BankProviderPort`.
- Métricas (Prometheus) e tracing (OpenTelemetry) nos clients HTTP para o Inter.

## Referências oficiais

- [Portal do desenvolvedor Inter Empresas](https://developers.inter.co/)
- Autenticação mTLS e OAuth: documentação de **Autenticação** e referência **Token**
- Banking: **extrato**, **saldo**, **webhooks**
