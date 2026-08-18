import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  RESTORE_SETTLED_CONFIRM,
  discoverFinanceUserIds,
  executeFinanceRestoreSettled,
} from "@/lib/finance-restore-settled";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "").trim();
    const confirm = String(body?.confirm || "").trim();
    if (confirm !== RESTORE_SETTLED_CONFIRM) {
      return NextResponse.json(
        {
          error: `Confirmação inválida. Envie confirm: "${RESTORE_SETTLED_CONFIRM}".`,
          hint: "Rode a prévia em /api/finance/restore-settled/preview antes.",
        },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const userIds = userId ? [userId] : await discoverFinanceUserIds(supabase);
    if (!userIds.length) return NextResponse.json({ error: "Nenhum user_id encontrado." }, { status: 400 });
    const results = [];
    for (const uid of userIds) {
      results.push(await executeFinanceRestoreSettled(supabase, uid, confirm));
    }
    const totals = results.reduce(
      (acc, r) => {
        acc.recebimentos += r.restored.recebimentos;
        acc.pagamentos += r.restored.pagamentos;
        acc.duplicatas += r.restored.duplicatas;
        acc.baixas += r.restored.baixas;
        acc.unchanged += r.unchanged;
        return acc;
      },
      { recebimentos: 0, pagamentos: 0, duplicatas: 0, baixas: 0, unchanged: 0 }
    );
    return NextResponse.json({
      ok: results.every((r) => r.ok),
      message:
        "Restauração concluída com evidência de baixa. Nenhuma movimentação de caixa nova foi criada. Backup em finance_migration_snapshots (ou archive).",
      totals,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}