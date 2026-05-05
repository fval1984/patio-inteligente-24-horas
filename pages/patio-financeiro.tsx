import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import PatioFinanceDashboard from "../components/finance/PatioFinanceDashboard";
import { resolveFinanceUserId } from "../lib/finance-resolve-user";
import type { CashMovement, PatioVehicle } from "../lib/patio-finance-math";
import { currentYearMonthLocal } from "../lib/patio-finance-math";
import { createSupabaseBrowser } from "../lib/supabase-browser";

export default function PatioFinanceiroPage() {
  const [supabase] = useState(() => createSupabaseBrowser());

  const [monthYm, setMonthYm] = useState(currentYearMonthLocal);
  const [vehicles, setVehicles] = useState<PatioVehicle[]>([]);
  const [cash, setCash] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setError("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.");
      setLoading(false);
      setAuthLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      setUserEmail(sess.session?.user?.email ?? null);
      if (!uid) {
        setError("Inicie sessão no Amplipatio (/app.html) neste mesmo domínio e volte a esta página.");
        setVehicles([]);
        setCash([]);
        setLoading(false);
        setAuthLoading(false);
        return;
      }
      const dataUserId = await resolveFinanceUserId(supabase, uid);

      const [vRes, cRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("user_id", dataUserId),
        supabase.from("cash_movements").select("*").eq("user_id", dataUserId),
      ]);

      if (vRes.error) throw vRes.error;
      if (cRes.error) throw cRes.error;

      setVehicles((vRes.data || []) as PatioVehicle[]);
      setCash((cRes.data || []) as CashMovement[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar dados.";
      setError(msg);
      setVehicles([]);
      setCash([]);
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadData();
    });
    return () => subscription.unsubscribe();
  }, [supabase, loadData]);

  const missingEnv = !supabase;

  return (
    <>
      <Head>
        <title>Financeiro · Pátio — Amplipatio</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <a href="/app.html" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
              ← Voltar ao app
            </a>
            <span className="text-xs text-slate-500">{userEmail ? `Sessão: ${userEmail}` : ""}</span>
          </div>
        </header>

        {missingEnv && (
          <div className="mx-auto max-w-5xl px-4 pt-6">
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Defina <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
              <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no ficheiro{" "}
              <code className="rounded bg-black/30 px-1">.env.local</code> e reinicie o servidor Next.js.
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-5xl px-4 pt-6">
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          </div>
        )}

        {!authLoading && !missingEnv && (
          <PatioFinanceDashboard
            vehicles={vehicles}
            cash={cash}
            monthYm={monthYm}
            onMonthYmChange={setMonthYm}
            loading={loading}
          />
        )}
      </div>
    </>
  );
}
