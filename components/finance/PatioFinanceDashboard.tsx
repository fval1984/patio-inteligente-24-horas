import { useMemo, useState } from "react";
import type { CashMovement, PatioVehicle } from "../../lib/patio-finance-math";
import {
  buildExtratoDays,
  calcDiariaValorGeradoNoDiaLocal,
  calcTotalVehicle,
  countVeiculosOperacaoPatio,
  formatBrl,
  saldoCaixaFromMovements,
  sumDiariasGeradasNoMes,
  sumCashPagamentosNoMes,
  toLocalYmd,
  vehiclesDiariasNoDia,
} from "../../lib/patio-finance-math";

type Props = {
  vehicles: PatioVehicle[];
  cash: CashMovement[];
  monthYm: string;
  onMonthYmChange: (ym: string) => void;
  loading?: boolean;
};

export default function PatioFinanceDashboard({
  vehicles,
  cash,
  monthYm,
  onMonthYmChange,
  loading,
}: Props) {
  const [diariasModalDay, setDiariasModalDay] = useState<string | null>(null);
  const [vehicleModal, setVehicleModal] = useState<PatioVehicle | null>(null);

  const metrics = useMemo(() => {
    const caixa = saldoCaixaFromMovements(cash);
    const entradasMes = sumDiariasGeradasNoMes(monthYm, vehicles);
    const saidasMes = sumCashPagamentosNoMes(monthYm, cash);
    const resultado = entradasMes - saidasMes;
    const todayYmd = toLocalYmd(new Date().toISOString());
    const receitaHoje = vehicles.reduce((s, v) => s + calcDiariaValorGeradoNoDiaLocal(v, todayYmd), 0);
    const pr = monthYm.split("-");
    const yyM = Number(pr[0]);
    const mmM = Number(pr[1]);
    const diasNoMes = yyM && mmM ? new Date(yyM, mmM, 0).getDate() : 30;
    const mediaMes = diasNoMes ? entradasMes / diasNoMes : 0;
    const vnp = countVeiculosOperacaoPatio(vehicles);
    return { caixa, entradasMes, saidasMes, resultado, receitaHoje, mediaMes, vnp };
  }, [vehicles, cash, monthYm]);

  const extrato = useMemo(() => buildExtratoDays(monthYm, vehicles, cash), [monthYm, vehicles, cash]);

  const diariasModalRows = useMemo(
    () => (diariasModalDay ? vehiclesDiariasNoDia(diariasModalDay, vehicles) : []),
    [diariasModalDay, vehicles]
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 text-slate-100">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Painel analítico do pátio</h1>
          <p className="text-sm text-slate-400">
            Só leitura — diárias, saldo e extrato por dia. Para lançar contas e movimentos, use o módulo «Operação financeira» em{" "}
            <a href="/app.html" className="font-semibold text-emerald-400 hover:text-emerald-300">
              /app.html
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Mês</label>
          <input
            type="month"
            value={monthYm}
            onChange={(e) => onMonthYmChange(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900/80 px-2 py-1.5 text-sm text-white"
          />
        </div>
      </div>

      {loading && <p className="mb-4 text-sm text-slate-400">A carregar…</p>}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_2fr]">
        <div
          className={`rounded-2xl border p-5 ${
            metrics.caixa >= 0
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-rose-500/40 bg-rose-500/10"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo em caixa</p>
          <p
            className={`mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl ${
              metrics.caixa >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatBrl(metrics.caixa)}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {metrics.caixa >= 0 ? "Posição consolidada pelos movimentos" : "Saldo negativo no caixa"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi title="Entradas (diárias)" value={formatBrl(metrics.entradasMes)} hint="Geradas no mês" tone="up" />
          <Kpi title="Saídas" value={formatBrl(metrics.saidasMes)} hint="Pagamentos no caixa" tone="down" />
          <Kpi
            title="Resultado"
            value={formatBrl(metrics.resultado)}
            hint="Diárias − despesas"
            tone={metrics.resultado >= 0 ? "up" : "down"}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-sm leading-relaxed text-slate-200">
        Hoje você faturou <strong className="text-emerald-400">{formatBrl(metrics.receitaHoje)}</strong> em diárias.
        Você tem <strong>{metrics.vnp}</strong> veículo(s) em operação no pátio. Média diária do mês:{" "}
        <strong>{formatBrl(metrics.mediaMes)}</strong>.
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Mini label="Veículos no pátio" value={String(metrics.vnp)} />
        <Mini label="Diárias hoje" value={formatBrl(metrics.receitaHoje)} accent />
        <Mini label="Média diária no mês" value={formatBrl(metrics.mediaMes)} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-white">Fluxo de caixa</h2>
        <p className="text-xs text-slate-500">Por dia — Diárias (geradas) e Despesas (pagas)</p>
        <div className="mt-4 flex flex-col gap-3">
          {extrato.length === 0 && !loading && (
            <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-6 text-center text-sm text-slate-400">
              Sem movimento neste mês.
            </p>
          )}
          {extrato.map((day) => (
            <article key={day.dayYmd} className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/60">
              <div className="border-b border-slate-700/80 bg-slate-800/50 px-4 py-2 text-sm font-bold text-white">
                {day.label}
              </div>
              <div className="divide-y divide-slate-700/50">
                {day.diarias > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiariasModalDay(day.dayYmd)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-emerald-500/5"
                  >
                    <div>
                      <div className="font-semibold text-white">Diárias</div>
                      <div className="text-xs text-slate-400">
                        {day.veiculosComDiaria} veículo{day.veiculosComDiaria !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className="font-bold text-emerald-400">+ {formatBrl(day.diarias)}</span>
                  </button>
                )}
                {day.despesas > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="font-semibold text-white">Despesas</div>
                      <div className="text-xs text-slate-400">Pagamentos no caixa</div>
                    </div>
                    <span className="font-bold text-rose-400">− {formatBrl(day.despesas)}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {diariasModalDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setDiariasModalDay(null)}
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b border-slate-700 px-4 py-3">
              <div>
                <h3 className="font-bold text-white">Diárias do dia</h3>
                <p className="text-xs text-slate-400">
                  Total {formatBrl(diariasModalRows.reduce((s, r) => s + r.val, 0))} · {diariasModalRows.length}{" "}
                  veículo(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiariasModalDay(null)}
                className="rounded-lg border border-slate-600 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {diariasModalRows.map(({ vehicle, val }) => (
                <li key={vehicle.id} className="border-b border-slate-800">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/80"
                    onClick={() => {
                      setVehicleModal(vehicle);
                      setDiariasModalDay(null);
                    }}
                  >
                    <span className="font-medium text-white">{vehicle.placa || "—"}</span>
                    <span className="font-semibold text-emerald-400">{formatBrl(val)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {vehicleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setVehicleModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-xl">
            <div className="flex justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold text-white">{vehicleModal.placa || "Veículo"}</h3>
                <p className="text-sm text-slate-400">
                  {[vehicleModal.marca, vehicleModal.modelo].filter(Boolean).join(" · ") || "Detalhes"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVehicleModal(null)}
                className="h-9 rounded-lg border border-slate-600 px-3 text-sm text-slate-300"
              >
                Fechar
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-2">
                <dt>Total acumulado (diárias)</dt>
                <dd className="font-semibold text-white">{formatBrl(calcTotalVehicle(vehicleModal))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Entrada</dt>
                <dd>{vehicleModal.data_entrada ? new Date(vehicleModal.data_entrada).toLocaleString("pt-BR") : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Dias no pátio</dt>
                <dd>
                  {vehicleModal.data_entrada
                    ? Math.max(
                        1,
                        Math.ceil(
                          (new Date(vehicleModal.data_saida || Date.now()).getTime() -
                            new Date(vehicleModal.data_entrada).getTime()) /
                            86400000
                        )
                      )
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Valor da diária</dt>
                <dd>{formatBrl(Number(vehicleModal.valor_diaria || 0))}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value, hint, tone }: { title: string; value: string; hint: string; tone: "up" | "down" }) {
  const border = tone === "up" ? "border-emerald-500/35" : "border-rose-500/30";
  const color = tone === "up" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className={`rounded-xl border bg-slate-900/80 p-4 ${border}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <p className={`text-base font-bold ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
