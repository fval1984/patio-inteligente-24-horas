import type { GetServerSideProps } from "next";
import Head from "next/head";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isPublicVehicleToken, type PublicVehicleHistory } from "@/lib/public-vehicle-history";

const LOGO = "/assets/ampliguard-logo-official.png?v=20261109qr1";
const LOGO_FALLBACK = "/assets/ampliguard-marca.png?v=20260917logo2";

type PageProps =
  | { ok: true; data: PublicVehicleHistory }
  | { ok: false; reason: "not_found" | "unavailable" };

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const token = String(ctx.params?.token || "").trim().toLowerCase();
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate");

  if (!isPublicVehicleToken(token)) {
    return { props: { ok: false, reason: "not_found" } };
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("consultar_historico_publico_veiculo", {
      p_token: token,
    });
    if (error || !data || data.ok !== true) {
      const msg = error?.message || "";
      if (/consultar_historico_publico_veiculo|schema cache|does not exist|PGRST|SUPABASE/i.test(msg)) {
        return { props: { ok: false, reason: "unavailable" } };
      }
      return { props: { ok: false, reason: "not_found" } };
    }
    return { props: { ok: true, data: data as PublicVehicleHistory } };
  } catch {
    return { props: { ok: false, reason: "unavailable" } };
  }
};

function esc(value: string | null | undefined): string {
  return String(value || "");
}

export default function PublicVehicleHistoryPage(props: PageProps) {
  if (!props.ok) {
    const title = props.reason === "unavailable" ? "Consulta indisponível" : "Registro não encontrado";
    const text =
      props.reason === "unavailable"
        ? "A consulta pública deste veículo está temporariamente indisponível."
        : "Este QR Code não corresponde a um registro de pátio AMPLIGUARD.";
    return (
      <>
        <Head>
          <title>{title} — AMPLIGUARD</title>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="pvh-page">
          <style dangerouslySetInnerHTML={{ __html: globalCss }} />
          <main className="pvh-card">
            <img src={LOGO} alt="AMPLIGUARD" className="pvh-logo" onError={(e) => { e.currentTarget.src = LOGO_FALLBACK; }} />
            <h1>{title}</h1>
            <p>{text}</p>
          </main>
        </div>
      </>
    );
  }

  const d = props.data;
  const modelo = [d.marca, d.modelo].filter(Boolean).join(" ") || "—";
  const hasVinculos = !!(d.financeira || d.escritorio || d.leiloeiro);

  return (
    <>
      <Head>
        <title>{esc(d.placa) || "Veículo"} — AMPLIGUARD</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f3d2e" />
      </Head>
      <div className="pvh-page">
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
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
      </div>
    </>
  );
}

const globalCss = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e8efe9; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #14221c; }
  .pvh-page { min-height: 100vh; padding: 20px 16px 32px; }
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
`;
