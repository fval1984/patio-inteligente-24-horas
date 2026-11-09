import type { GetServerSideProps } from "next";
import Head from "next/head";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isPublicVehicleToken, type PublicVehicleHistory } from "@/lib/public-vehicle-history";

const LOGO = "/assets/ampliguard-logo-official.png?v=20261109qr1";
const LOGO_FALLBACK = "/assets/ampliguard-marca.png?v=20260917logo2";
/** Substitua public/assets/ampliguard-qr-splash.jpg para trocar a tela de carregamento. */
const SPLASH_SRC = "/assets/ampliguard-qr-splash.jpg";
const SPLASH_MS = 8000;

type FichaTipo = 1 | 2;

type Ficha2Extras = {
  data_entrada: string | null;
  data_saida: string | null;
  valor_diaria: number | null;
  chave_condicao: string | null;
};

type PageProps =
  | { ok: true; fichaTipo: FichaTipo; data: PublicVehicleHistory; extras: Ficha2Extras | null }
  | { ok: false; fichaTipo: FichaTipo; reason: "not_found" | "unavailable" };

function parseFichaTipo(raw: string | string[] | undefined): FichaTipo {
  const v = String(Array.isArray(raw) ? raw[0] : raw || "1")
    .trim()
    .toLowerCase();
  if (v === "2" || v === "tipo2" || v === "tipo-2" || v === "ficha2") return 2;
  return 1;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function loadFicha2Extras(token: string): Promise<Ficha2Extras | null> {
  try {
    const admin = getSupabaseAdmin();
    const full = await admin
      .from("vehicles")
      .select("data_entrada,data_saida,valor_diaria,chave_condicao")
      .ilike("public_token", token)
      .maybeSingle();
    const row =
      full.data ||
      (
        await admin
          .from("vehicles")
          .select("data_entrada,data_saida")
          .ilike("public_token", token)
          .maybeSingle()
      ).data;
    if (!row) return null;
    const vd = Number((row as { valor_diaria?: number }).valor_diaria);
    return {
      data_entrada: asIso(row.data_entrada),
      data_saida: asIso(row.data_saida),
      valor_diaria: Number.isFinite(vd) && vd > 0 ? vd : null,
      chave_condicao: (row as { chave_condicao?: string }).chave_condicao
        ? String((row as { chave_condicao?: string }).chave_condicao)
        : null,
    };
  } catch {
    return null;
  }
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const token = String(ctx.params?.token || "").trim().toLowerCase();
  const fichaTipo = parseFichaTipo(ctx.query.ficha ?? ctx.query.f ?? ctx.query.tipo);
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate");

  if (!isPublicVehicleToken(token)) {
    return { props: { ok: false, fichaTipo, reason: "not_found" } };
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("consultar_historico_publico_veiculo", {
      p_token: token,
    });
    if (error || !data || data.ok !== true) {
      const msg = error?.message || "";
      if (/consultar_historico_publico_veiculo|schema cache|does not exist|PGRST|SUPABASE/i.test(msg)) {
        return { props: { ok: false, fichaTipo, reason: "unavailable" } };
      }
      return { props: { ok: false, fichaTipo, reason: "not_found" } };
    }
    const extras = fichaTipo === 2 ? await loadFicha2Extras(token) : null;
    return {
      props: {
        ok: true,
        fichaTipo,
        data: data as PublicVehicleHistory,
        extras,
      },
    };
  } catch {
    return { props: { ok: false, fichaTipo, reason: "unavailable" } };
  }
};

function esc(value: string | null | undefined): string {
  return String(value || "");
}

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function stayMetrics(entrada: string | null, saida: string | null, diaria: number | null) {
  if (!entrada) return { days: 0, hours: 0, total: 0 };
  const start = new Date(entrada);
  const end = saida ? new Date(saida) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.ceil(diffMs / 86400000));
  const hours = Math.max(0, Math.floor(diffMs / 3600000));
  const vd = Number(diaria);
  const total = Number.isFinite(vd) && vd > 0 ? days * vd : 0;
  return { days, hours, total };
}

function chaveChip(raw: string | null | undefined) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_");
  if (s === "C_CHAVE" || s === "CCHAVE") return { emoji: "🟢", label: "C/CHAVE", cls: "is-c-chave" };
  if (s === "S_CHAVE" || s === "SCHAVE") return { emoji: "🟡", label: "S/CHAVE", cls: "is-s-chave" };
  if (s === "TRANCADO") return { emoji: "🔴", label: "TRANCADO", cls: "is-trancado" };
  return null;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Recife",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

declare global {
  interface Window {
    vehicleFichaTipo2Pix?: {
      buildPayload: (amount: number, descricao: string) => string;
      validate: (payload: string, expectedAmount: number) => { ok: boolean; payload?: string };
      qrDataUrl: (payload: string) => Promise<string>;
    };
  }
}

function SplashScreen() {
  return (
    <div className="pvh-splash" role="status" aria-live="polite">
      <img src={SPLASH_SRC} alt="AMPLIGUARD — Guarda e custódia de bens" className="pvh-splash-img" />
      <div className="pvh-splash-spin" aria-hidden="true" />
      <p className="pvh-splash-msg">Carregando informações do veículo...</p>
    </div>
  );
}

export default function PublicVehicleHistoryPage(props: PageProps) {
  const [ready, setReady] = useState(false);
  const [pixUrl, setPixUrl] = useState("");
  const [pixError, setPixError] = useState("");

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const left = SPLASH_MS - (Date.now() - start);
      if (left <= 0) {
        document.documentElement.setAttribute("data-pvh-ready", "1");
        setReady(true);
        return;
      }
      window.setTimeout(tick, Math.min(250, left));
    };
    const existing = document.documentElement.getAttribute("data-pvh-ready") === "1";
    if (existing) {
      setReady(true);
      return;
    }
    tick();
  }, []);

  const extras = props.ok && props.fichaTipo === 2 ? props.extras : null;
  const metrics = useMemo(
    () => stayMetrics(extras?.data_entrada || null, extras?.data_saida || null, extras?.valor_diaria || null),
    [extras]
  );

  useEffect(() => {
    if (!props.ok || props.fichaTipo !== 2 || metrics.total <= 0) return;
    let cancelled = false;
    const run = async () => {
      const waitLib = async () => {
        for (let i = 0; i < 40; i++) {
          if (window.vehicleFichaTipo2Pix) return window.vehicleFichaTipo2Pix;
          await new Promise((r) => setTimeout(r, 100));
        }
        return null;
      };
      const pix = await waitLib();
      if (!pix || cancelled) {
        if (!cancelled) setPixError("Não foi possível montar o QR Code Pix.");
        return;
      }
      const payload = pix.buildPayload(metrics.total, `AMPLIGUARD ${props.data.placa || ""}`.trim());
      const check = pix.validate(payload, metrics.total);
      if (!check.ok) {
        if (!cancelled) setPixError("Não foi possível validar o QR Code Pix.");
        return;
      }
      const url = await pix.qrDataUrl(check.payload || payload);
      if (cancelled) return;
      if (!url) setPixError("Não foi possível desenhar o QR Code Pix.");
      else setPixUrl(url);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props, metrics.total]);

  const title = !props.ok
    ? props.reason === "unavailable"
      ? "Consulta indisponível"
      : "Registro não encontrado"
    : esc(props.data.placa) || "Veículo";

  const errorText =
    !props.ok && props.reason === "unavailable"
      ? "Não foi possível carregar a ficha deste veículo. Tente novamente em instantes."
      : "Este QR Code não corresponde a um registro de pátio AMPLIGUARD.";

  return (
    <>
      <Head>
        <title>{title} — AMPLIGUARD</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#06241c" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(document.documentElement.getAttribute("data-pvh-ready")==="1")return;setTimeout(function(){document.documentElement.setAttribute("data-pvh-ready","1");},${SPLASH_MS});})();`,
          }}
        />
      </Head>
      {props.ok && props.fichaTipo === 2 ? (
        <>
          <Script src="/vendor/qrcode.min.js?v=20261005recibo1" strategy="afterInteractive" />
          <Script src="/vehicle-ficha-tipo2-pix.js?v=20261109pix1" strategy="afterInteractive" />
        </>
      ) : null}
      <div className="pvh-page">
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        <SplashScreen />
        <div className="pvh-ficha" aria-hidden={ready ? "false" : "true"}>
          {!props.ok ? (
            <main className="pvh-card">
              <img src={LOGO} alt="AMPLIGUARD" className="pvh-logo" onError={(e) => { e.currentTarget.src = LOGO_FALLBACK; }} />
              <h1>{title}</h1>
              <p>{errorText}</p>
            </main>
          ) : props.fichaTipo === 2 ? (
            <FichaTipo2 data={props.data} extras={extras} metrics={metrics} pixUrl={pixUrl} pixError={pixError} />
          ) : (
            <FichaTipo1 data={props.data} />
          )}
        </div>
      </div>
    </>
  );
}

function FichaTipo1({ data }: { data: PublicVehicleHistory }) {
  const d = data;
  const modelo = [d.marca, d.modelo].filter(Boolean).join(" ") || "—";
  const hasVinculos = !!(d.financeira || d.escritorio || d.leiloeiro);
  return (
    <main className="pvh-card">
      <img
        src={LOGO}
        alt="AMPLIGUARD"
        className="pvh-logo"
        onError={(e) => {
          e.currentTarget.src = LOGO_FALLBACK;
        }}
      />
      <p className="pvh-kicker">Histórico público do veículo</p>
      <h1 className="pvh-plate">{esc(d.placa) || "—"}</h1>
      <p className="pvh-model">{modelo}</p>
      <span className="pvh-status">{esc(d.status_label)}</span>
      <dl className="pvh-meta">
        <div>
          <dt>Cor</dt>
          <dd>{esc(d.cor) || "—"}</dd>
        </div>
        <div>
          <dt>Entrada no pátio</dt>
          <dd>{esc(d.data_entrada_label) || "—"}</dd>
        </div>
      </dl>
      {hasVinculos ? (
        <section>
          <h2>Informações vinculadas</h2>
          <dl className="pvh-meta">
            {d.financeira ? (
              <div>
                <dt>Instituição financeira</dt>
                <dd>{esc(d.financeira)}</dd>
              </div>
            ) : null}
            {d.escritorio ? (
              <div>
                <dt>Escritório responsável</dt>
                <dd>{esc(d.escritorio)}</dd>
              </div>
            ) : null}
            {d.leiloeiro ? (
              <div>
                <dt>Leilão / leiloeiro</dt>
                <dd>{esc(d.leiloeiro)}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
      <section>
        <h2>Histórico</h2>
        {(d.timeline || []).length ? (
          <ol className="pvh-timeline">
            {(d.timeline || []).map((item) => (
              <li key={`${item.code}-${item.at}`}>
                <strong>{esc(item.title)}</strong>
                <time>{esc(item.at_label) || "—"}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pvh-empty">Ainda não há acontecimentos registrados para consulta.</p>
        )}
      </section>
      <p className="pvh-foot">Consulta somente leitura · AMPLIGUARD</p>
    </main>
  );
}

function FichaTipo2({
  data,
  extras,
  metrics,
  pixUrl,
  pixError,
}: {
  data: PublicVehicleHistory;
  extras: Ficha2Extras | null;
  metrics: { days: number; hours: number; total: number };
  pixUrl: string;
  pixError: string;
}) {
  const d = data;
  const modelo = [d.marca, d.modelo].filter(Boolean).join(" ") || "—";
  const chave = chaveChip(extras?.chave_condicao);
  const diariaTxt = extras?.valor_diaria ? formatBRL(extras.valor_diaria) : "—";
  const totalTxt = formatBRL(metrics.total);
  return (
    <main className="pvh-card pvh-card--tipo2">
      <img
        src={LOGO}
        alt="AMPLIGUARD"
        className="pvh-logo"
        onError={(e) => {
          e.currentTarget.src = LOGO_FALLBACK;
        }}
      />
      <p className="pvh-kicker">Permanência e cobrança</p>
      <h1 className="pvh-plate">{esc(d.placa) || "—"}</h1>
      <p className="pvh-model">{modelo}</p>
      <dl className="pvh-meta">
        <div>
          <dt>Marca / modelo</dt>
          <dd>{modelo}</dd>
        </div>
        <div>
          <dt>Cor</dt>
          <dd>{esc(d.cor) || "—"}</dd>
        </div>
        <div>
          <dt>Instituição financeira</dt>
          <dd>{esc(d.financeira) || "Sem financeira informada"}</dd>
        </div>
        <div>
          <dt>Entrada no pátio</dt>
          <dd>{esc(d.data_entrada_label) || "—"}</dd>
        </div>
        <div>
          <dt>Saída do pátio</dt>
          <dd>{extras?.data_saida ? formatWhen(extras.data_saida) : "Ainda no pátio"}</dd>
        </div>
      </dl>
      <section className="pvh-status-row">
        <div>
          <h2>Status do veículo</h2>
          <p className="pvh-status-value">{esc(d.status_label)}</p>
        </div>
        {chave ? (
          <div>
            <h2>Condição da chave</h2>
            <p className="pvh-chave">
              <span className={`pvh-chave-chip ${chave.cls}`}>
                {chave.emoji} {chave.label}
              </span>
            </p>
          </div>
        ) : null}
      </section>
      <section className="pvh-finance">
        <h2>Permanência no pátio</h2>
        <dl className="pvh-meta">
          <div>
            <dt>Quantidade de dias</dt>
            <dd>{String(metrics.days)}</dd>
          </div>
          <div>
            <dt>Quantidade de horas</dt>
            <dd>{String(metrics.hours)}</dd>
          </div>
          <div>
            <dt>Valor da diária</dt>
            <dd>{diariaTxt}</dd>
          </div>
        </dl>
        <p className="pvh-total-label">Valor total devido</p>
        <p className="pvh-total">{totalTxt}</p>
      </section>
      <section>
        <h2>Pagamento Pix</h2>
        {metrics.total > 0 && pixUrl ? (
          <div className="pvh-pix">
            <img className="pvh-pix-qr" alt="QR Code Pix para pagamento" src={pixUrl} />
            <div>
              <p className="pvh-pix-amount">{totalTxt}</p>
              <p className="pvh-pix-hint">O valor entra no código Pix. Este QR não dá baixa no financeiro.</p>
              <p className="pvh-pix-fav">AMPLIGUARD · CNPJ 57.936.119/0001-98</p>
            </div>
          </div>
        ) : (
          <p className="pvh-empty">{pixError || "Não há valor de diária para montar o Pix desta ficha."}</p>
        )}
      </section>
      <p className="pvh-foot">Consulta somente leitura · AMPLIGUARD</p>
    </main>
  );
}

const globalCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #06241c; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #14221c; }
  .pvh-page { min-height: 100vh; min-height: 100dvh; }
  .pvh-splash {
    position: fixed; inset: 0; z-index: 20;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #06241c; padding: 20px 16px; text-align: center;
  }
  .pvh-splash-img {
    display: block; width: auto; height: auto;
    max-width: min(92vw, 420px); max-height: min(72vh, 720px);
    object-fit: contain;
  }
  .pvh-splash-spin {
    width: 28px; height: 28px; margin: 18px 0 10px;
    border: 3px solid rgba(255,255,255,.22);
    border-top-color: #fff; border-radius: 50%;
    animation: pvhspin .85s linear infinite;
  }
  .pvh-splash-msg { margin: 0; color: #e8efe9; font-size: 15px; font-weight: 600; }
  @keyframes pvhspin { to { transform: rotate(360deg); } }
  .pvh-ficha { display: none; padding: 20px 16px 32px; background: #e8efe9; min-height: 100vh; min-height: 100dvh; }
  html[data-pvh-ready="1"] .pvh-splash { display: none; }
  html[data-pvh-ready="1"] .pvh-ficha { display: block; }
  .pvh-card {
    max-width: 420px; margin: 0 auto; background: #fff;
    border-radius: 16px; padding: 22px 20px 18px;
    box-shadow: 0 10px 30px rgba(15, 61, 46, 0.12);
  }
  .pvh-logo { display: block; width: min(220px, 70%); height: auto; margin: 0 auto 12px; }
  .pvh-kicker { text-align: center; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: #4d6a5c; margin: 0 0 6px; }
  .pvh-plate { text-align: center; font-size: 28px; letter-spacing: 0.12em; margin: 0 0 4px; }
  .pvh-model { text-align: center; margin: 0 0 12px; font-size: 16px; }
  .pvh-status {
    display: block; text-align: center; background: #0f3d2e; color: #fff;
    border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; margin: 0 auto 18px; width: fit-content;
  }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #4d6a5c; margin: 18px 0 8px; }
  .pvh-meta { margin: 0; }
  .pvh-meta div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #e3ece6; }
  .pvh-meta dt { color: #4d6a5c; font-size: 13px; }
  .pvh-meta dd { margin: 0; font-weight: 600; text-align: right; }
  .pvh-timeline { list-style: none; margin: 0; padding: 0; border-left: 3px solid #0f3d2e; }
  .pvh-timeline li { padding: 0 0 14px 14px; position: relative; }
  .pvh-timeline li::before {
    content: ""; position: absolute; left: -7px; top: 6px; width: 11px; height: 11px;
    background: #0f3d2e; border-radius: 50%;
  }
  .pvh-timeline strong { display: block; font-size: 15px; }
  .pvh-timeline time { font-size: 13px; color: #4d6a5c; }
  .pvh-empty, .pvh-foot { text-align: center; color: #4d6a5c; font-size: 13px; }
  .pvh-foot { margin: 22px 0 0; }
  h1 { font-size: 22px; text-align: center; }
  .pvh-card > p { text-align: center; }
  .pvh-status-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pvh-status-row h2 { margin-top: 12px; }
  .pvh-status-value { margin: 0; font-weight: 700; }
  .pvh-chave { margin: 0; }
  .pvh-chave-chip {
    display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px;
    font-size: 12px; font-weight: 800;
  }
  .pvh-chave-chip.is-c-chave { background: #dcfce7; color: #166534; }
  .pvh-chave-chip.is-s-chave { background: #fef9c3; color: #854d0e; }
  .pvh-chave-chip.is-trancado { background: #fee2e2; color: #b91c1c; }
  .pvh-finance { background: #f4f8f5; border-radius: 12px; padding: 8px 12px 12px; margin-top: 8px; border: 1px solid #c5d9cc; }
  .pvh-total-label { margin: 10px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #4d6a5c; }
  .pvh-total { margin: 2px 0 0; font-size: 26px; font-weight: 800; color: #0f3d2e; }
  .pvh-pix { display: flex; gap: 12px; align-items: center; }
  .pvh-pix-qr { width: 132px; height: 132px; flex: 0 0 auto; background: #fff; }
  .pvh-pix-amount { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #0f3d2e; }
  .pvh-pix-hint, .pvh-pix-fav { margin: 0 0 6px; font-size: 12px; color: #4d6a5c; line-height: 1.35; text-align: left; }
  .pvh-pix-fav { margin: 0; font-weight: 600; color: #14221c; }
  @media (max-width: 420px) {
    .pvh-status-row, .pvh-pix { grid-template-columns: 1fr; flex-direction: column; align-items: flex-start; }
  }
`;
