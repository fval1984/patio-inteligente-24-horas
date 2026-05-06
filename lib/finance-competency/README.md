# Módulo Financeiro por Competência

Este módulo implementa regras contábeis por competência com separação entre:

- **regras de negócio**: `service.ts`
- **persistência**: `repository.ts` e `supabase-repository.ts`
- **integração HTTP**: rotas em `app/api/finance/*`

## Funções de domínio

- `generateDailyCharges(userId, vehicleId, referenceDate?)`
  - Gera diária do dia.
  - Incrementa receita bruta e contas a receber.
  - Evita duplicação por `vehicle + charge_date + status`.
- `closeVehicleCycle(userId, vehicleId, discountAmount, isFullWaiver, closeDate?)`
  - Encerra ciclo.
  - Aplica desconto parcial ou isenção total.
  - Registra dedução sem apagar histórico.
- `registerPayment(userId, receivableId, amount, paymentDate?, method?)`
  - Registra pagamento.
  - Baixa contas a receber.
  - Impede pagamento acima do saldo.

## Endpoints

- `POST /api/finance/generate-daily-charges`
  - Body: `{ userId, vehicleId?, referenceDate? }`
  - Sem `vehicleId`, gera para todos os veículos ativos (uso em job diário).
- `POST /api/finance/close-vehicle-cycle`
  - Body: `{ userId, vehicleId, discountAmount, isFullWaiver, closeDate? }`
- `POST /api/finance/register-payment`
  - Body: `{ userId, receivableId, amount, paymentDate?, method? }`

## Exemplo rápido

```ts
await fetch("/api/finance/generate-daily-charges", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ userId: "<USER_ID>" }),
});
```

```ts
await fetch("/api/finance/close-vehicle-cycle", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "<USER_ID>",
    vehicleId: "<VEHICLE_ID>",
    discountAmount: 35.5,
    isFullWaiver: false,
  }),
});
```

```ts
await fetch("/api/finance/register-payment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "<USER_ID>",
    receivableId: "<RECEIVABLE_ID>",
    amount: 120,
    method: "PIX",
  }),
});
```

## Relatórios (base pronta)

Com as tabelas novas, fica simples calcular:

- Receita bruta: soma de `revenue.amount` com `type = 'DAILY_CHARGE'`
- Descontos: soma de `revenue_deductions.amount`
- Receita líquida: receita bruta - descontos
- Saldo a receber: soma de `accounts_receivable.balance_amount` em aberto
- Caixa recebido: soma de `payments.amount` confirmados

## Testes básicos

Arquivo: `lib/finance-competency/basic-tests.ts`

Inclui cenários mínimos:

- impedir duplicação de diária no mesmo dia
- aplicar desconto no fechamento
- bloquear pagamento acima do saldo
