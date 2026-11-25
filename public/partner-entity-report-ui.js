/**
 * Relatórios de Localizador, Pátio e Financeira.
 * Mesmo documento do relatório de escritório (tela, impressão e PDF).
 * Não grava dados e não altera o relatório de escritório.
 */
(function partnerEntityReportUi(global) {
  "use strict";

  const LOGO = "/assets/ampliguard-marca.png?v=20260917logo2";
  const FOOTER = "AMPLIGUARD – Guarda, Custódia e Remoção de Veículos";
  let _token = 0;
  let _bound = false;
  let _issuedLabel = "";
  let _model = null;
  let _drill = "all";
  let _sort = { key: "dataEntrada", dir: "desc" };
  let _bucket = "month";
  let _kindId = "";
  let _sub = "cadastro";
  let _generated = {};
  let _filters = {};

  function svc() {
    return global.advocacyOfficesService;
  }

  function linkSvc() {
    return global.partnerEntityReportService;
  }

  function currentKind() {
    return (linkSvc() && linkSvc().kindOf(_kindId)) || null;
  }

  function esc(str) {
    return String(str != null ? str : "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dash(value) {
    const s = String(value == null ? "" : value).trim();
    return s ? s : "—";
  }

  function fmtYmd(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return "—";
    const [y, m, d] = String(ymd).split("-");
    return `${d}/${m}/${y}`;
  }

  function fmtDates(list) {
    if (!list || !list.length) return "—";
    return list.map((d) => fmtYmd(d)).join(" · ");
  }

  function fmtMoney(n) {
    if (n == null || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtWhen(date) {
    try {
      return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch (_e) {
      return date.toLocaleString("pt-BR");
    }
  }

  function state() {
    return global.__ampliState || {};
  }

  function setActions(on) {
    ["pePrintReport", "pePdfReport"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = !on;
      el.classList.toggle("hidden", !on);
    });
  }

  function classifyReceivable(r) {
    if (!r) return { skip: true };
    if (typeof global.receivableSemCobrancaFinanceira === "function" && global.receivableSemCobrancaFinanceira(r)) {
      return { skip: true };
    }
    if (typeof global.financeReceivableIsDuplicateOfPaidCycle === "function" && global.financeReceivableIsDuplicateOfPaidCycle(r)) {
      return { skip: true };
    }
    const display =
      typeof global.financeReceivableDisplayStatus === "function" ? global.financeReceivableDisplayStatus(r) : "";
    const received =
      display === "Recebido" ||
      (typeof global.receivableFluxoFinanceiroQuitado === "function" && global.receivableFluxoFinanceiroQuitado(r));
    const awaiting =
      !received &&
      typeof global.receivableIsAguardandoFaturamentoFinanceiro === "function" &&
      global.receivableIsAguardandoFaturamentoFinanceiro(r);
    const inReceber =
      typeof global.receivableIsContaReceberFinanceiro === "function" && global.receivableIsContaReceberFinanceiro(r);
    const fatConcluido =
      typeof global.receivableFaturamentoConcluido === "function" && global.receivableFaturamentoConcluido(r);
    const billed = !!(received || (!awaiting && (inReceber || fatConcluido)));
    const overdue = !!(billed && !received && (display === "Vencido" || display === "Atrasado"));
    const closures = state().cycleClosures || [];
    const closure = closures.find((c) => String(c.receivable_id) === String(r.id));
    const toYmd = (v) => (svc() ? svc().toLocalYmd(v) || "" : "");
    let pagoEm = "";
    if (received && typeof global.financeMetaUnpack === "function") {
      try {
        const meta = global.financeMetaUnpack(r.observacoes || "").meta || {};
        pagoEm = toYmd(meta.data_pagamento || meta.data_recebimento);
      } catch (_e) {
        pagoEm = "";
      }
    }
    if (received && !pagoEm) {
      const dates = (state().cash || [])
        .filter((m) => String(m.conta_id) === String(r.id))
        .map((m) => toYmd(m.data_movimento))
        .filter(Boolean)
        .sort();
      pagoEm = dates.length ? dates[dates.length - 1] : "";
    }
    return {
      skip: false,
      valor: Number(r.valor || 0),
      billed,
      received: !!received,
      overdue,
      faturadoEm: billed ? toYmd(r.faturado_em) || toYmd(closure && closure.faturado_em) : "",
      pagoEm,
    };
  }

  async function loadEvents(ids) {
    const map = {};
    const client = global.supabaseClient;
    const service = svc();
    if (!client || !service || !ids.length) return map;
    const tipos = ["LIBERACAO_SOLICITADA", "LIBERACAO_CONFIRMADA", "REMOCAO_CONFIRMADA", "REMOVIDO"];
    for (let i = 0; i < ids.length; i += 80) {
      const chunk = ids.slice(i, i + 80);
      let data = null;
      try {
        const res = await client.from("vehicle_events").select("vehicle_id,tipo,created_at").in("vehicle_id", chunk).in("tipo", tipos);
        if (!res.error) data = res.data || [];
      } catch (_e) {
        data = null;
      }
      (data || []).forEach((e) => {
        const id = String(e.vehicle_id || "");
        if (!id) return;
        const bucket = map[id] || (map[id] = {});
        const tipo = String(e.tipo || "").toUpperCase();
        const day = service.toLocalYmd(e.created_at) || "";
        if (!day) return;
        if (tipo === "LIBERACAO_SOLICITADA") {
          if (!bucket.solicitacao || day < bucket.solicitacao) bucket.solicitacao = day;
        } else if (tipo === "LIBERACAO_CONFIRMADA" || tipo === "REMOCAO_CONFIRMADA") {
          if (!bucket.confirmacao || day < bucket.confirmacao) bucket.confirmacao = day;
        } else if (tipo === "REMOVIDO") {
          if (!bucket.retirada || day > bucket.retirada) bucket.retirada = day;
        }
      });
    }
    return map;
  }

  function filterLines(filters) {
    const st = state();
    const service = svc();
    const bits = [];
    bits.push(`Período: ${fmtYmd(filters.from)} a ${fmtYmd(filters.to)}`);
    if (filters.entradaFrom || filters.entradaTo) {
      bits.push(`Entrada: ${fmtYmd(filters.entradaFrom)} a ${fmtYmd(filters.entradaTo)}`);
    }
    if (filters.saidaFrom || filters.saidaTo) {
      bits.push(`Saída: ${fmtYmd(filters.saidaFrom)} a ${fmtYmd(filters.saidaTo)}`);
    }
    if (filters.officeId) {
      const name =
        filters.officeId === "__sem__"
          ? "Sem escritório informado"
          : service.officeName(filters.officeId, st.advocacyOffices || []);
      bits.push(`Escritório: ${dash(name)}`);
    }
    if (filters.managerId) {
      bits.push(`Gestor de Carteira: ${dash(service.managerName(filters.managerId, st.advocacyOfficeManagers || []))}`);
    }
    if (filters.patioId) {
      const p = (st.partners || []).find((x) => String(x.id) === String(filters.patioId));
      bits.push(`Pátio: ${dash(p && p.nome)}`);
    }
    if (filters.status) {
      const labels = { VNP: "No Pátio", VSL: "Solicitação de Liberação", VSC: "Liberação Confirmada", VRP: "Retirado do Pátio" };
      bits.push(`Status: ${labels[filters.status] || filters.status}`);
    }
    if (filters.faturamento === "faturado") bits.push("Faturamento: Faturado");
    if (filters.faturamento === "nao_faturado") bits.push("Faturamento: Não faturado");
    if (filters.pagamento === "pago") bits.push("Pagamento: Pago");
    if (filters.pagamento === "aberto") bits.push("Pagamento: Em aberto");
    if (filters.pagamento === "vencido") bits.push("Pagamento: Vencido");
    if (filters.financeiraId) {
      const p = (st.partners || []).find((x) => String(x.id) === String(filters.financeiraId));
      bits.push(`Financeira: ${dash(p && p.nome)}`);
    }
    if (filters.tipoVeiculo) bits.push(`Tipo: ${filters.tipoVeiculo}`);
    if (filters.situacaoPatio) bits.push(`Situação no pátio: ${filters.situacaoPatio}`);
    return bits;
  }

  function bucketWord(mode) {
    if (mode === "day") return "por dia";
    if (mode === "week") return "por semana";
    return "por mês";
  }

  function pointLabel(key, mode) {
    if (!key) return "";
    if (mode === "month") {
      const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      const parts = String(key).split("-");
      const m = Number(parts[1]);
      return `${names[m - 1] || parts[1]}/${String(parts[0] || "").slice(2)}`;
    }
    return fmtYmd(key).slice(0, 5);
  }

  function axisTick(n, money) {
    const x = Number(n) || 0;
    if (!money) return String(Math.round(x));
    if (Math.abs(x) >= 1000) return `${(x / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
    return x.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }

  function drillLabel(id) {
    const bands = (svc() && svc().STAY_BANDS) || [];
    const band = bands.find((b) => `band:${b.id}` === id);
    if (band) return band.label;
    const labels = {
      patio: "Atualmente no pátio",
      entradas: "Entradas no período",
      saidas: "Saídas no período",
      vsl: "Aguardando liberação",
      vsc: "Liberação confirmada",
      maior: "Maior permanência atual",
      gerado: "Veículos com valor de diária",
      faturado: "Total faturado",
      recebido: "Total recebido",
      aberto: "Total em aberto",
      "attn:longa": "Permanência acima de 60 dias",
      "attn:vsc": "Liberados que ainda não foram retirados",
      "attn:fat": "Retirados aguardando faturamento",
      "attn:vencido": "Valores vencidos",
      "attn:aberto": "Valores em aberto",
      "attn:sem-mov": "Sem solicitação de liberação há 30 dias ou mais",
    };
    return labels[id] || "";
  }

  function chartSvg(series, labels, money) {
    const n = labels.length;
    if (!n) return `<p class="ao-note">Sem datas no período para montar este gráfico.</p>`;
    const W = 1040;
    const H = 250;
    const padL = 58;
    const padR = 12;
    const padT = 14;
    const padB = 40;
    let max = 0;
    series.forEach((s) => {
      (s.values || []).forEach((v) => {
        if (v != null && Number(v) > max) max = Number(v);
      });
    });
    if (max <= 0) max = 1;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const groupW = plotW / n;
    const barW = Math.max(1.5, Math.min(12, (groupW * 0.76) / Math.max(1, series.length)));
    const ticks = !money && max <= 6 ? Array.from({ length: Math.round(max) + 1 }, (_, i) => i) : [0, 1, 2, 3, 4].map((t) => (max * t) / 4);
    const parts = [`<svg class="ao-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`];
    const seenTick = new Set();
    ticks.forEach((val) => {
      const y = padT + plotH - (Number(val) / max) * plotH;
      parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" />`);
      const tick = axisTick(val, money);
      if (seenTick.has(tick)) return;
      seenTick.add(tick);
      parts.push(
        `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${esc(tick)}</text>`
      );
    });
    series.forEach((s, si) => {
      (s.values || []).forEach((v, i) => {
        const num = Number(v) || 0;
        const h = (num / max) * plotH;
        const x = padL + i * groupW + (groupW - series.length * barW) / 2 + si * barW;
        const y = padT + plotH - h;
        const tip = `${s.name}: ${money ? fmtMoney(num) : String(num)}`;
        parts.push(
          `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${s.color}"><title>${esc(tip)}</title></rect>`
        );
      });
    });
    const step = n > 14 ? Math.ceil(n / 12) : 1;
    labels.forEach((label, i) => {
      if (i % step && i !== n - 1) return;
      const x = padL + i * groupW + groupW / 2;
      parts.push(
        `<text x="${x.toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="10" fill="#475569">${esc(label)}</text>`
      );
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function lineSvg(values, labels) {
    const nums = (values || []).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
    if (!nums.length) return `<p class="ao-note">Não há permanência registrada neste recorte para calcular a média.</p>`;
    const n = labels.length;
    const W = 1040;
    const H = 250;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 40;
    let max = Math.max(1, ...nums);
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const stepX = n <= 1 ? 0 : plotW / (n - 1);
    const yOf = (v) => padT + plotH - (Number(v) / max) * plotH;
    const xOf = (i) => padL + i * stepX;
    const parts = [`<svg class="ao-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`];
    for (let t = 0; t <= 4; t += 1) {
      const val = (max * t) / 4;
      const y = padT + plotH - (plotH * t) / 4;
      parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" />`);
      parts.push(
        `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${esc(String(Math.round(val)))}</text>`
      );
    }
    let d = "";
    let drawing = false;
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(Number(v))) {
        drawing = false;
        return;
      }
      const cmd = drawing ? "L" : "M";
      drawing = true;
      d += `${cmd}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
    });
    if (d) parts.push(`<path d="${d.trim()}" fill="none" stroke="#0f766e" stroke-width="2.5" />`);
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(Number(v))) return;
      parts.push(
        `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="3.5" fill="#0f766e"><title>${esc(labels[i])}: média de ${esc(String(v))} dias</title></circle>`
      );
    });
    const step = n > 14 ? Math.ceil(n / 12) : 1;
    labels.forEach((label, i) => {
      if (i % step && i !== n - 1) return;
      parts.push(
        `<text x="${xOf(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" font-size="10" fill="#475569">${esc(label)}</text>`
      );
    });
    parts.push("</svg>");
    return parts.join("");
  }

  function legendHtml(items) {
    return `<div class="ao-legend">${items
      .map((item) => `<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`)
      .join("")}</div>`;
  }

  function cardHtml(id, label, value, money) {
    const on = id && _drill === id ? " ao-on" : "";
    const cls = `ao-card${money ? " ao-money" : ""}${on}`;
    const inner = `<strong>${esc(value)}</strong><span>${esc(label)}</span>`;
    if (!id) return `<div class="${cls}">${inner}</div>`;
    return `<button type="button" class="${cls}" data-ao-drill="${esc(id)}">${inner}</button>`;
  }

  function field(label, value) {
    return `<div><span>${esc(label)}</span> ${esc(dash(value))}</div>`;
  }

  function summaryRows(summary) {
    const rows = [
      ["Total de veículos", String(summary.veiculos)],
      ["Veículos atualmente no pátio", String(summary.noPatio)],
      ["Veículos com solicitação de liberação", String(summary.vsl)],
      ["Veículos com liberação confirmada", String(summary.vsc)],
      ["Veículos já retirados", String(summary.retirados)],
      ["Total de diárias geradas", String(summary.diarias)],
      ["Valor total das estadias", fmtMoney(summary.estadia)],
      ["Valor já faturado", fmtMoney(summary.faturado)],
      ["Valor recebido", fmtMoney(summary.recebido)],
      ["Valor em aberto", fmtMoney(summary.aberto)],
    ];
    if (summary.vencido > 0) rows.push(["Valor vencido", fmtMoney(summary.vencido)]);
    return rows;
  }

  function renderHtml(model) {
    const service = svc();
    const office = model.office || {};
    const summary = model.summary || {};
    const vehicles = model.vehicles || [];
    const insights = model.insights || {};
    const filters = model.filters || {};
    const timeline = service.officeReportTimeline(vehicles, filters, _bucket, insights.asOf);
    const labels = (timeline.points || []).map((p) => pointLabel(p.key, timeline.bucket));
    const listed = service.sortOfficeReportRows(service.filterOfficeReportDrill(vehicles, _drill, filters), _sort);
    const lines = filterLines(model.filters || {});
    const sumBody = summaryRows(summary)
      .map(
        (pair) =>
          `<tr data-ao-block data-ao-role="row"><td>${esc(pair[0])}</td><td>${esc(pair[1])}</td></tr>`
      )
      .join("");
    const vehiclesHtml = listed.length
      ? listed
          .map((r) => {
            return `<article class="ao-veh" data-ao-block>
              <h3>${esc(dash(r.placa))} · ${esc(dash(r.veiculo))}</h3>
              <p class="ao-stage">${esc(r.situacao)}</p>
              <div class="ao-fields">
                ${field("RPP/RPV", r.rppRpv)}
                ${field("Placa", r.placa)}
                ${field("Marca/Modelo", r.veiculo)}
                ${field("Cor", r.cor)}
                ${field("Parceiro", r.parceiro)}
                ${field("Escritório", r.escritorio)}
                ${field("Gestor de Carteira", r.gestor)}
                ${field("Pátio", r.patio)}
                ${field("Data de entrada", fmtYmd(r.dataEntrada))}
                ${field("Solicitação de liberação", fmtYmd(r.dataSolicitacao))}
                ${field("Confirmação da liberação", fmtYmd(r.dataConfirmacao))}
                ${field("Retirada / saída", fmtYmd(r.dataSaida))}
                ${field("Dias de estadia", r.dias ? String(r.dias) : "—")}
                ${field("Valor da diária", fmtMoney(r.valorDiaria))}
                ${field("Valor total da estadia", fmtMoney(r.estadia))}
                ${field("Situação do veículo", r.situacao)}
                ${field("Situação do faturamento", r.faturamento)}
                ${field("Situação do pagamento", r.pagamento)}
                ${field("Data do faturamento", fmtDates(r.faturadoEm))}
                ${field("Data do pagamento", fmtDates(r.pagoEm))}
                ${field("Observações", r.observacoes)}
              </div>
            </article>`;
          })
          .join("")
      : `<p class="ao-empty" data-ao-block>${vehicles.length ? "Nenhum veículo neste indicador." : "Nenhum veículo encontrado com os filtros selecionados."}</p>`;
    const finHead = `<thead>
      <tr>
        <th>Placa</th><th>Veículo</th><th>Dias</th><th>Diária</th><th>Estadia</th>
        <th>Faturado</th><th>Recebido</th><th>Em aberto</th><th>Vencido</th>
        <th>Faturamento</th><th>Pagamento</th><th>Faturado em</th><th>Pago em</th>
      </tr>
    </thead>`;
    const finRows = vehicles.length
      ? vehicles
          .map(
            (r) => `<tr data-ao-block data-ao-role="row">
              <td>${esc(dash(r.placa))}</td>
              <td>${esc(dash(r.veiculo))}</td>
              <td>${esc(r.dias ? String(r.dias) : "—")}</td>
              <td>${esc(fmtMoney(r.valorDiaria))}</td>
              <td>${esc(fmtMoney(r.estadia))}</td>
              <td>${esc(fmtMoney(r.faturadoValor))}</td>
              <td>${esc(fmtMoney(r.recebido))}</td>
              <td>${esc(fmtMoney(r.aberto))}</td>
              <td>${esc(r.vencido > 0 ? fmtMoney(r.vencido) : "—")}</td>
              <td>${esc(dash(r.faturamento))}</td>
              <td>${esc(dash(r.pagamento))}</td>
              <td>${esc(fmtDates(r.faturadoEm))}</td>
              <td>${esc(fmtDates(r.pagoEm))}</td>
            </tr>`
          )
          .join("")
      : `<tr data-ao-block data-ao-role="row"><td colspan="13">Nenhum veículo no filtro.</td></tr>`;
    const semDiaria =
      summary.semDiaria > 0
        ? `<p class="ao-note" data-ao-block>${summary.semDiaria} veículo(s) sem valor de diária cadastrado. Esses registros não entram no valor total das estadias.</p>`
        : "";
    const pts = timeline.points || [];
    const mediaTxt = insights.mediaDias == null ? "—" : `${insights.mediaDias} dias`;
    const maiorTxt = insights.maiorDias == null ? "—" : `${insights.maiorDias} dias`;
    const cards = `<div class="ao-cards" data-ao-block>
      ${cardHtml("all", "Total de veículos", String(summary.veiculos || 0), false)}
      ${cardHtml("patio", "Atualmente no pátio", String(summary.noPatio || 0), false)}
      ${cardHtml("entradas", "Entradas no período", String(insights.entradas || 0), false)}
      ${cardHtml("saidas", "Saídas no período", String(insights.saidas || 0), false)}
      ${cardHtml("vsl", "Aguardando liberação", String(summary.vsl || 0), false)}
      ${cardHtml("vsc", "Liberação confirmada", String(summary.vsc || 0), false)}
      ${cardHtml("", "Média de dias no pátio", mediaTxt, false)}
      ${cardHtml("maior", "Maior permanência atual", maiorTxt, false)}
      ${cardHtml("gerado", "Total gerado em estadias", fmtMoney(insights.geradoPeriodo), true)}
      ${cardHtml("faturado", "Total faturado", fmtMoney(summary.faturado), true)}
      ${cardHtml("recebido", "Total recebido", fmtMoney(summary.recebido), true)}
      ${cardHtml("aberto", "Total em aberto", fmtMoney(summary.aberto), true)}
    </div>`;
    const modes = [
      ["day", "Dia"],
      ["week", "Semana"],
      ["month", "Mês"],
    ];
    const switcher = `<div class="ao-switch ao-screen-only">${modes
      .map(
        ([id, label]) =>
          `<button type="button" class="ao-bucket${_bucket === id ? " ao-on" : ""}" data-ao-bucket="${id}">${label}</button>`
      )
      .join("")}</div>`;
    const grouped = `<span class="ao-print-label">Agrupado ${esc(bucketWord(timeline.bucket || _bucket))}</span>`;
    const vehSeries = [
      { name: "Entradas", color: "#0284c7", values: pts.map((p) => p.entradas) },
      { name: "Saídas", color: "#b91c1c", values: pts.map((p) => p.saidas) },
      { name: "Permanência", color: "#0f766e", values: pts.map((p) => p.permanencia) },
    ];
    const finSeries = [
      { name: "Gerado em estadias", color: "#0369a1", values: pts.map((p) => p.gerado) },
      { name: "Faturado", color: "#7c3aed", values: pts.map((p) => p.faturado) },
      { name: "Recebido", color: "#15803d", values: pts.map((p) => p.recebido) },
      { name: "Em aberto", color: "#b45309", values: pts.map((p) => p.aberto) },
    ];
    const sliceWord = timeline.bucket === "day" ? "dia" : timeline.bucket === "week" ? "semana" : "mês";
    const maxBand = Math.max(1, ...((insights.bands || []).map((b) => b.quantidade) ));
    const bands = (insights.bands || [])
      .map((b) => {
        const width = Math.round((b.quantidade / maxBand) * 100);
        const on = _drill === `band:${b.id}` ? " ao-on" : "";
        return `<button type="button" class="ao-band${on}" data-ao-band="${esc(b.id)}"><span>${esc(b.label)}</span><span class="ao-bar"><i style="width:${width}%"></i></span><strong>${esc(String(b.quantidade))}</strong></button>`;
      })
      .join("");
    const top = (insights.maiorPermanencia || []).slice(0, 15);
    const topRows = top.length
      ? top
          .map(
            (r) => `<tr data-ao-block data-ao-role="row">
              <td>${esc(dash(r.placa))}</td>
              <td>${esc(dash(r.veiculo))}</td>
              <td>${esc(fmtYmd(r.dataEntrada))}</td>
              <td>${esc(r.dias ? String(r.dias) : "—")}</td>
              <td>${esc(dash(r.patio))}</td>
              <td>${esc(dash(r.gestor))}</td>
              <td>${esc(dash(r.situacao))}</td>
            </tr>`
          )
          .join("")
      : `<tr data-ao-block data-ao-role="row"><td colspan="7">Nenhum veículo no pátio neste filtro.</td></tr>`;
    const etapas = insights.etapas || {};
    const stageCard = (title, info) => {
      const txt = !info || info.media == null ? "—" : `${info.media} dias`;
      const sub = !info || !info.quantidade ? "Sem datas registradas para esta etapa." : `${info.quantidade} veículo(s) com as duas datas`;
      return `<div class="ao-stage-card"><strong>${esc(txt)}</strong><span>${esc(title)}</span><small>${esc(sub)}</small></div>`;
    };
    const at = insights.atencao || {};
    const moneyOf = (list, key) => (list || []).reduce((s, r) => Math.round((s + (Number(r[key]) || 0)) * 100) / 100, 0);
    const attn = (id, title, list, extra) => {
      const n = (list || []).length;
      if (!n) return `<div class="ao-attn ao-muted"><strong>0</strong><span>${esc(title)}</span><small>Nenhum registro</small></div>`;
      const on = _drill === id ? " ao-on" : "";
      return `<button type="button" class="ao-attn${on}" data-ao-attn="${esc(id)}"><strong>${n}</strong><span>${esc(title)}</span>${extra ? `<small>${esc(extra)}</small>` : ""}</button>`;
    };
    const sortCols = [
      ["placa", "Placa"],
      ["veiculo", "Marca/Modelo"],
      ["dataEntrada", "Entrada"],
      ["dias", "Dias no pátio"],
      ["dataSaida", "Saída"],
      ["estadia", "Estadia"],
      ["situacao", "Status"],
      ["gestor", "Gestor de Carteira"],
      ["patio", "Pátio"],
    ];
    const sortHead = sortCols
      .map(([key, label]) => {
        const mark = _sort.key === key ? (_sort.dir === "asc" ? " ▲" : " ▼") : "";
        const on = _sort.key === key ? " ao-on" : "";
        return `<th><button type="button" class="ao-sort${on}" data-ao-col="${key}">${esc(label)}${esc(mark)}</button></th>`;
      })
      .join("");
    const scanRows = listed.length
      ? listed
          .map(
            (r) => `<tr data-ao-block data-ao-role="row">
              <td>${esc(dash(r.placa))}</td>
              <td>${esc(dash(r.veiculo))}</td>
              <td>${esc(fmtYmd(r.dataEntrada))}</td>
              <td>${esc(r.dias ? String(r.dias) : "—")}</td>
              <td>${esc(fmtYmd(r.dataSaida))}</td>
              <td>${esc(fmtMoney(r.estadia))}</td>
              <td>${esc(dash(r.situacao))}</td>
              <td>${esc(dash(r.gestor))}</td>
              <td>${esc(dash(r.patio))}</td>
            </tr>`
          )
          .join("")
      : `<tr data-ao-block data-ao-role="row"><td colspan="9">${vehicles.length ? "Nenhum veículo neste indicador." : "Nenhum veículo no filtro."}</td></tr>`;
    const banner =
      _drill !== "all" && drillLabel(_drill)
        ? `<p class="ao-banner" data-ao-block>Lista filtrada por: ${esc(drillLabel(_drill))}. ${listed.length} veículo(s). <button type="button" class="ao-clear ao-screen-only" data-ao-clear>Mostrar todos</button></p>`
        : "";
    const fatNote =
      insights.semDataFaturamento > 0
        ? `<p class="ao-note">${insights.semDataFaturamento} título(s) faturado(s) sem data de faturamento ficam de fora deste gráfico. O total faturado do resumo continua completo.</p>`
        : "";
    const pagoNote =
      insights.semDataPagamento > 0
        ? `<p class="ao-note">${insights.semDataPagamento} título(s) recebido(s) sem data de pagamento não entram na linha de recebimento. O total recebido do resumo continua completo.</p>`
        : "";
    return `<article class="ao-doc pe-entity-doc" id="peEntityDoc">
      <div class="ao-doc-head" data-ao-block>
        <img src="${esc(LOGO)}" alt="AMPLIGUARD" />
        <h1>${esc(model.title || "RELATÓRIO")}</h1>
        <p class="ao-office-name">${esc(dash(office.name))}</p>
        <p>${esc(office.cnpjLabel || "CNPJ")}: ${esc(dash(office.cnpj))}</p>
        <p>${esc(office.managerLabel || "Gestor(es) de Carteira")}: ${esc(dash(office.managers))}</p>
        <p>${esc(lines[0] || "")}</p>
        <p>Emitido em ${esc(_issuedLabel)}</p>
        ${lines.length > 1 ? `<p class="ao-filters">${esc(lines.slice(1).join(" · "))}</p>` : ""}
      </div>
      <h2 data-ao-block>Resumo geral</h2>
      <p class="ao-note" data-ao-block>Os cards acompanham o período e os filtros. No pátio reúne quem ainda não foi retirado (VNP, VSL e VSC). Total gerado em estadias soma a diária dos dias de permanência que caem dentro do período. O valor total das estadias, na tabela abaixo, continua sendo a estadia completa de cada veículo.</p>
      ${cards}
      ${switcher}
      <p class="ao-note" data-ao-block>No pátio + retirados = total de veículos. Solicitação e liberação confirmada são etapas de quem ainda está no pátio.</p>
      <table class="ao-table">
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>${sumBody}</tbody>
      </table>
      ${semDiaria}
      <h2 data-ao-block>Evolução de Veículos — Entradas x Saídas x Permanência</h2>
      <figure class="ao-chart" data-ao-block>
        ${grouped}
        ${chartSvg(vehSeries, labels, false)}
        ${legendHtml(vehSeries)}
        <p class="ao-note">Permanência é a quantidade de veículos do relatório com pelo menos um dia de estadia naquele ${esc(sliceWord)}.</p>
      </figure>
      <h2 data-ao-block>Evolução dos dias de permanência</h2>
      <figure class="ao-chart" data-ao-block>
        ${grouped}
        ${lineSvg(pts.map((p) => p.mediaDias), labels)}
        <p class="ao-note">Média dos dias já cumpridos pelos veículos que estavam no pátio em cada ${esc(sliceWord)}, calculada com a data de entrada e o último dia de estadia daquele recorte.</p>
      </figure>
      <h2 data-ao-block>Faixa de dias no pátio</h2>
      <p class="ao-note" data-ao-block>Somente veículos que ainda não foram retirados. O clique filtra a relação detalhada.</p>
      <div class="ao-bands" data-ao-block>${bands}</div>
      <h2 data-ao-block>Veículos com maior permanência</h2>
      <p class="ao-note" data-ao-block>Os 15 veículos que estão há mais tempo no pátio. A relação completa continua na lista detalhada.</p>
      <table class="ao-table">
        <thead><tr><th>Placa</th><th>Marca/Modelo</th><th>Entrada</th><th>Dias no pátio</th><th>Pátio</th><th>Gestor de Carteira</th><th>Status</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
      <h2 data-ao-block>Evolução financeira</h2>
      <figure class="ao-chart" data-ao-block>
        ${grouped}
        ${chartSvg(finSeries, labels, true)}
        ${legendHtml(finSeries)}
        <p class="ao-note">Gerado usa a diária de cada dia de estadia do recorte. Faturado e recebido só entram quando o título tem a data gravada. Em aberto é o saldo faturado ainda não recebido ao fim de cada ${esc(sliceWord)}.</p>
        ${fatNote}
        ${pagoNote}
      </figure>
      <h2 data-ao-block>Tempo médio por etapa</h2>
      <p class="ao-note" data-ao-block>Fluxo VNP → VSL → VSC → VRP. A média só usa veículos que têm as duas datas da etapa.</p>
      <div class="ao-stages" data-ao-block>
        ${stageCard("Entrada → Solicitação de liberação", etapas.entradaSolicitacao)}
        ${stageCard("Solicitação de liberação → Liberação confirmada", etapas.solicitacaoConfirmacao)}
        ${stageCard("Liberação confirmada → Retirada", etapas.confirmacaoRetirada)}
        ${stageCard("Entrada → Retirada", etapas.entradaRetirada)}
      </div>
      <h2 data-ao-block>O que precisa de atenção</h2>
      <div class="ao-attns" data-ao-block>
        ${attn("attn:longa", "Permanência acima de 60 dias", at.longa, "")}
        ${attn("attn:vsc", "Liberados que ainda não foram retirados", at.liberados, "")}
        ${attn("attn:fat", "Retirados aguardando faturamento", at.aguardandoFaturamento, "")}
        ${attn("attn:vencido", "Valores vencidos", at.vencidos, fmtMoney(moneyOf(at.vencidos, "vencido")))}
        ${attn("attn:aberto", "Valores em aberto", at.abertos, fmtMoney(moneyOf(at.abertos, "aberto")))}
        ${attn("attn:sem-mov", "Sem solicitação de liberação há 30 dias ou mais", at.semMovimento, "")}
      </div>
      <h2 id="peEntityDetail" data-ao-block>Relação detalhada dos veículos</h2>
      ${banner}
      <p class="ao-note" data-ao-block>Fluxo do pátio: VNP → VSL → VSC → VRP. Dias de estadia: da entrada até a saída, ou até a data de emissão se o veículo ainda está no pátio. Clique no título da coluna para ordenar. A ficha de cada veículo, abaixo, conserva todos os campos.</p>
      <table class="ao-table ao-scan">
        <thead><tr>${sortHead}</tr></thead>
        <tbody>${scanRows}</tbody>
      </table>
      ${vehiclesHtml}
      <h2 data-ao-block>Informações financeiras</h2>
      <p class="ao-note" data-ao-block>Valores lidos dos títulos já gravados no financeiro. Total a receber é o valor faturado que ainda não foi recebido. O vencido é a parte desse valor com vencimento anterior à emissão. Veículo sem título faturado fica como não faturado, sem valor em aberto inventado. ${_drill !== "all" ? "Este resumo usa todos os veículos do filtro do relatório, não só a lista do indicador clicado." : ""}</p>
      <table class="ao-table">
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>
          <tr data-ao-block data-ao-role="row"><td>Total das estadias</td><td>${esc(fmtMoney(summary.estadia))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total faturado</td><td>${esc(fmtMoney(summary.faturado))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total a receber</td><td>${esc(fmtMoney(summary.aberto))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total recebido</td><td>${esc(fmtMoney(summary.recebido))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Total vencido</td><td>${esc(summary.vencido > 0 ? fmtMoney(summary.vencido) : "—")}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Registros em aberto</td><td>${esc(String(summary.registrosAbertos || 0))}</td></tr>
          <tr data-ao-block data-ao-role="row"><td>Registros pagos</td><td>${esc(String(summary.registrosPagos || 0))}</td></tr>
        </tbody>
      </table>
      <h2 data-ao-block>Detalhamento financeiro por veículo</h2>
      <table class="ao-table ao-fin">
        ${finHead}
        <tbody>${finRows}</tbody>
      </table>
      <div class="ao-foot-screen">
        <span>${esc(FOOTER)}</span>
        <span>Emitido em ${esc(_issuedLabel)}</span>
      </div>
      <div class="ao-foot-print" aria-hidden="true">
        <span>${esc(FOOTER)}</span>
        <span>Emitido em ${esc(_issuedLabel)}</span>
        <span>Página <span class="ao-page-num"></span></span>
      </div>
    </article>`;
  }

  const DOC_CSS = `
    #peEntityDoc.ao-doc { background:#fff; color:#0f2744; font-family:"Segoe UI", system-ui, sans-serif; padding:16px 16px 8px; border:1px solid #e2e8f0; border-radius:12px; }
    #peEntityDoc .ao-doc-head { display:block; text-align:center; background:#fff; color:#0f2744; border-bottom:3px solid #b91c1c; padding:0 0 12px; margin:0 0 14px; }
    #peEntityDoc .ao-doc-head img { display:block; margin:0 auto 8px; height:64px; width:auto; max-width:280px; max-height:64px; object-fit:contain; }
    #peEntityDoc .ao-doc-head h1 { display:block; margin:10px 0 6px; font-size:16pt; letter-spacing:.02em; color:#0f2744; background:transparent; }
    #peEntityDoc .ao-doc-head p { display:block; margin:2px 0; font-size:10.5pt; color:#0f2744; }
    #peEntityDoc .ao-office-name { font-size:13pt !important; font-weight:700; }
    #peEntityDoc .ao-filters { color:#475569; font-size:9.5pt !important; }
    #peEntityDoc h2 { margin:16px 0 8px; font-size:12.5pt; border-bottom:1px solid #e2e8f0; padding-bottom:4px; page-break-after:avoid; }
    #peEntityDoc .ao-note { margin:0 0 8px; color:#475569; font-size:9pt; }
    #peEntityDoc .ao-empty { margin:8px 0 12px; }
    #peEntityDoc .ao-table { width:100%; border-collapse:collapse; margin:0 0 12px; }
    #peEntityDoc .ao-table th, #peEntityDoc .ao-table td { border:1px solid #cbd5e1; padding:5px 6px; text-align:left; vertical-align:top; font-size:8.5pt; overflow-wrap:break-word; }
    #peEntityDoc .ao-table th { background:#f1f5f9; font-size:8pt; }
    #peEntityDoc .ao-fin { font-size:8pt; }
    #peEntityDoc .ao-veh { border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin:0 0 8px; page-break-inside:avoid; break-inside:avoid; }
    #peEntityDoc .ao-veh h3 { margin:0; font-size:11pt; }
    #peEntityDoc .ao-stage { margin:2px 0 6px; font-weight:700; color:#9f1239; font-size:9.5pt; }
    #peEntityDoc .ao-fields { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; }
    #peEntityDoc .ao-fields div { font-size:9pt; }
    #peEntityDoc .ao-fields span { color:#64748b; }
    #peEntityDoc .ao-cards { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; margin:0 0 12px; }
    #peEntityDoc .ao-card { display:block; width:100%; text-align:left; background:#f8fafc; border:1px solid #dbe3ee; border-radius:10px; padding:10px 12px; color:#0f2744; font:inherit; cursor:pointer; }
    #peEntityDoc div.ao-card { cursor:default; }
    #peEntityDoc .ao-card strong { display:block; font-size:16pt; line-height:1.15; }
    #peEntityDoc .ao-card.ao-money strong { font-size:12.5pt; }
    #peEntityDoc .ao-card span { display:block; margin-top:4px; color:#475569; font-size:8.5pt; }
    #peEntityDoc .ao-card.ao-on, #peEntityDoc .ao-band.ao-on, #peEntityDoc .ao-attn.ao-on { border-color:#0f766e; background:#f0fdfa; box-shadow:inset 0 0 0 1px #0f766e; }
    #peEntityDoc .ao-switch { display:flex; gap:6px; margin:0 0 8px; }
    #peEntityDoc .ao-bucket, #peEntityDoc .ao-sort, #peEntityDoc .ao-screen-only button { font:inherit; }
    #peEntityDoc .ao-bucket { border:1px solid #cbd5e1; background:#fff; border-radius:999px; padding:4px 12px; cursor:pointer; color:#0f2744; }
    #peEntityDoc .ao-bucket.ao-on { background:#0f766e; color:#fff; border-color:#0f766e; }
    #peEntityDoc .ao-print-label { display:none; color:#475569; font-size:9pt; }
    #peEntityDoc .ao-chart { margin:0 0 8px; }
    #peEntityDoc .ao-svg { display:block; width:100%; max-width:1040px; height:auto; }
    #peEntityDoc .ao-legend { display:flex; flex-wrap:wrap; gap:10px 16px; margin:6px 0; font-size:9pt; color:#334155; }
    #peEntityDoc .ao-legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; }
    #peEntityDoc .ao-bands, #peEntityDoc .ao-attns, #peEntityDoc .ao-stages { display:grid; gap:6px; margin:0 0 12px; }
    #peEntityDoc .ao-stages { grid-template-columns:repeat(4, minmax(0, 1fr)); }
    #peEntityDoc .ao-attns { grid-template-columns:repeat(3, minmax(0, 1fr)); }
    #peEntityDoc .ao-band { display:grid; grid-template-columns:150px 1fr 36px; gap:8px; align-items:center; width:100%; text-align:left; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:6px 8px; font:inherit; color:#0f2744; cursor:pointer; }
    #peEntityDoc .ao-bar { display:block; height:10px; background:#e2e8f0; border-radius:999px; overflow:hidden; }
    #peEntityDoc .ao-bar i { display:block; height:10px; background:#0f766e; border-radius:999px; }
    #peEntityDoc .ao-stage-card, #peEntityDoc .ao-attn { background:#f8fafc; border:1px solid #dbe3ee; border-radius:10px; padding:10px 12px; text-align:left; color:#0f2744; }
    #peEntityDoc .ao-attn { width:100%; font:inherit; cursor:pointer; }
    #peEntityDoc .ao-attn.ao-muted { cursor:default; opacity:.72; }
    #peEntityDoc .ao-stage-card strong, #peEntityDoc .ao-attn strong { display:block; font-size:14pt; }
    #peEntityDoc .ao-stage-card span, #peEntityDoc .ao-attn span, #peEntityDoc .ao-stage-card small, #peEntityDoc .ao-attn small { display:block; margin-top:3px; color:#475569; font-size:8.5pt; }
    #peEntityDoc .ao-sort { background:transparent; border:0; padding:0; font-weight:700; color:inherit; cursor:pointer; text-align:left; }
    #peEntityDoc .ao-sort.ao-on { color:#0f766e; }
    #peEntityDoc .ao-banner { background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; padding:8px 10px; margin:0 0 8px; }
    #peEntityDoc button.ao-card,
    #peEntityDoc button.ao-band,
    #peEntityDoc button.ao-attn,
    #peEntityDoc button.ao-clear {
      background:#f8fafc !important;
      color:#0f2744 !important;
      border:1px solid #dbe3ee !important;
      box-shadow:none !important;
      min-height:0 !important;
      letter-spacing:0 !important;
      text-transform:none !important;
    }
    #peEntityDoc button.ao-card strong,
    #peEntityDoc button.ao-band strong,
    #peEntityDoc button.ao-attn strong { color:#0f2744 !important; }
    #peEntityDoc button.ao-card span,
    #peEntityDoc button.ao-band span,
    #peEntityDoc button.ao-attn span,
    #peEntityDoc button.ao-card small,
    #peEntityDoc button.ao-attn small { color:#475569 !important; }
    #peEntityDoc button.ao-card.ao-on,
    #peEntityDoc button.ao-band.ao-on,
    #peEntityDoc button.ao-attn.ao-on { background:#f0fdfa !important; border-color:#0f766e !important; }
    #peEntityDoc button.ao-bucket { background:#fff !important; color:#0f2744 !important; border:1px solid #cbd5e1 !important; box-shadow:none !important; min-height:0 !important; letter-spacing:0 !important; border-radius:999px !important; padding:4px 12px !important; }
    #peEntityDoc button.ao-bucket.ao-on { background:#0f766e !important; color:#fff !important; border-color:#0f766e !important; }
    #peEntityDoc button.ao-sort { background:transparent !important; color:#334155 !important; border:0 !important; box-shadow:none !important; min-height:0 !important; letter-spacing:0 !important; padding:0 !important; border-radius:0 !important; }
    #peEntityDoc button.ao-sort.ao-on { color:#0f766e !important; }
    #peEntityDoc button.ao-card:hover,
    #peEntityDoc button.ao-band:hover,
    #peEntityDoc button.ao-attn:hover,
    #peEntityDoc button.ao-bucket:hover,
    #peEntityDoc button.ao-sort:hover { transform:none; }
    #peEntityDoc .ao-foot-screen, #peEntityDoc .ao-foot-print { display:flex; justify-content:space-between; gap:8px; margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; color:#64748b; font-size:8.5pt; background:#fff; position:static; }
    #peEntityDoc .ao-foot-print { display:none; }
    @media (max-width: 820px) {
      #peEntityDoc { overflow-x:auto; -webkit-overflow-scrolling:touch; }
      #peEntityDoc .ao-cards { grid-template-columns:1fr 1fr; }
      #peEntityDoc .ao-stages, #peEntityDoc .ao-attns { grid-template-columns:1fr; }
      #peEntityDoc .ao-fields { grid-template-columns:1fr; }
      #peEntityDoc .ao-band { grid-template-columns:1fr; }
      #peEntityDoc .ao-doc-head h1 { font-size:13.5pt; }
    }
    @media (max-width: 520px) {
      #peEntityDoc .ao-cards { grid-template-columns:1fr; }
    }
    @media print {
      #peEntityDoc { border:0; border-radius:0; padding:0 0 16mm; }
      #peEntityDoc .ao-screen-only { display:none !important; }
      #peEntityDoc .ao-print-label { display:inline !important; }
      #peEntityDoc .ao-foot-screen { display:none !important; }
      #peEntityDoc .ao-foot-print { display:flex !important; position:fixed; left:0; right:0; bottom:0; margin:0; padding:4px 0; background:#fff; }
      #peEntityDoc .ao-page-num::after { content: counter(page); }
      #peEntityDoc thead { display:table-header-group; }
      #peEntityDoc tr, #peEntityDoc .ao-veh, #peEntityDoc .ao-doc-head, #peEntityDoc .ao-chart, #peEntityDoc .ao-cards, #peEntityDoc .ao-bands, #peEntityDoc .ao-stages, #peEntityDoc .ao-attns { break-inside:avoid; page-break-inside:avoid; }
      #peEntityDoc h2 { break-after:avoid; page-break-after:avoid; }
    }
  `;

  function ensureStyles() {
    let style = document.getElementById("peEntityReportStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "peEntityReportStyles";
      document.head.appendChild(style);
    }
    if (style.textContent !== DOC_CSS) style.textContent = DOC_CSS;
  }

  function docEl() {
    return document.getElementById("peEntityDoc");
  }

  function printVehicleRows() {
    const service = svc();
    const vehicles = (_model && _model.vehicles) || [];
    const filters = (_model && _model.filters) || {};
    if (!service) return vehicles;
    return service.sortOfficeReportRows(service.filterOfficeReportDrill(vehicles, _drill, filters), _sort);
  }

  function printBodyHtml() {
    const model = _model;
    if (!model) return "";
    const office = model.office || {};
    const summary = model.summary || {};
    const insights = model.insights || {};
    const lines = filterLines(model.filters || {});
    const counts = [
      ["Total de veículos", String(summary.veiculos || 0)],
      ["Atualmente no pátio", String(summary.noPatio || 0)],
      ["Entradas no período", String(insights.entradas || 0)],
      ["Saídas no período", String(insights.saidas || 0)],
      ["Solicitação de liberação", String(summary.vsl || 0)],
      ["Liberação confirmada", String(summary.vsc || 0)],
      ["Retirados do pátio", String(summary.retirados || 0)],
    ];
    const sumBody = counts
      .map((pair) => `<tr><td>${esc(pair[0])}</td><td>${esc(pair[1])}</td></tr>`)
      .join("");
    const listed = printVehicleRows();
    const rows = listed.length
      ? listed
          .map(
            (r) => `<tr data-pe-keep>
              <td>${esc(dash(r.placa))}</td>
              <td>${esc(dash(r.veiculo))}</td>
              <td>${esc(dash(r.financeira))}</td>
              <td>${esc(dash(r.encaminhou))}</td>
              <td>${esc(fmtYmd(r.dataEntrada))}</td>
              <td>${esc(r.dataSaida ? fmtYmd(r.dataSaida) : "—")}</td>
              <td>${esc(dash(r.situacao))}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="7">${listed.length || (model.vehicles || []).length ? "Nenhum veículo neste indicador." : "Nenhum veículo encontrado com os filtros selecionados."}</td></tr>`;
    const banner =
      _drill !== "all" && drillLabel(_drill)
        ? `<p class="ao-note" data-pe-keep>Lista filtrada por: ${esc(drillLabel(_drill))}. ${listed.length} veículo(s).</p>`
        : "";
    return `<article class="ao-doc pe-entity-doc" id="peEntityDoc">
      <div class="ao-doc-head" data-pe-keep>
        <img src="${esc(LOGO)}" alt="AMPLIGUARD" />
        <h1>${esc(model.title || "RELATÓRIO")}</h1>
        <p class="ao-office-name">${esc(dash(office.name))}</p>
        <p>${esc(office.cnpjLabel || "CNPJ")}: ${esc(dash(office.cnpj))}</p>
        <p>${esc(office.managerLabel || "Gestor(es) de Carteira")}: ${esc(dash(office.managers))}</p>
        <p>${esc(lines[0] || "")}</p>
        <p>Emitido em ${esc(_issuedLabel)}</p>
        ${lines.length > 1 ? `<p class="ao-filters">${esc(lines.slice(1).join(" · "))}</p>` : ""}
      </div>
      <h2 data-pe-keep>Resumo dos veículos</h2>
      <table class="ao-table" data-pe-keep>
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>${sumBody}</tbody>
      </table>
      <h2 data-pe-keep>Veículos</h2>
      ${banner}
      <table class="ao-table">
        <thead>
          <tr>
            <th>Placa</th>
            <th>Marca e modelo</th>
            <th>Financeira</th>
            <th>Quem encaminhou</th>
            <th>Entrada</th>
            <th>Saída</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="ao-foot-print" aria-hidden="true">
        <span>${esc(FOOTER)}</span>
        <span>Emitido em ${esc(_issuedLabel)}</span>
        <span>Página <span class="ao-page-num"></span></span>
      </div>
    </article>`;
  }

  function printSourceHtml() {
    const body = printBodyHtml();
    if (!body) return "";
    const origin = global.location && global.location.origin ? global.location.origin : "";
    const html = body.replace(LOGO, origin + LOGO);
    const title = (_model && _model.printTitle) || "Relatório";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>${DOC_CSS}
      @page { margin: 12mm; }
      body { margin: 0; background: #fff; }
      #peEntityDoc { border: 0; border-radius: 0; box-shadow: none; padding: 0 0 16mm; max-width: 1100px; }
      </style></head><body>${html}</body></html>`;
  }

  function openPrintFrame(html) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", (_model && _model.printTitle) || "Relatório");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1100px;height:1400px;border:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return null;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return iframe;
  }

  function whenImagesReady(doc) {
    const imgs = Array.from((doc && doc.images) || []);
    const ready = Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }
          })
      )
    );
    const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
    return Promise.race([ready, timeout]);
  }

  function printDoc() {
    const page = printSourceHtml();
    if (!page) {
      alert(beforeAction("imprimir"));
      return;
    }
    const iframe = openPrintFrame(page);
    const win = iframe && iframe.contentWindow;
    if (!win) {
      alert("Não foi possível preparar a impressão neste navegador.");
      return;
    }
    whenImagesReady(win.document).then(() => {
      try {
        win.focus();
        win.print();
      } catch (_e) {
        /* ignore */
      }
      setTimeout(() => iframe.remove(), 1500);
    });
  }

  async function downloadPdf() {
    const page = printSourceHtml();
    if (!page) {
      alert(beforeAction("baixar o PDF"));
      return;
    }
    const btn = document.getElementById("pePdfReport");
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Gerando PDF…";
    }
    const iframe = openPrintFrame(page);
    try {
      if (typeof global.loadJsPdf === "function") await global.loadJsPdf();
      if (typeof global.loadHtml2Canvas === "function") await global.loadHtml2Canvas();
      const jsPdfCtor = global.jspdf && global.jspdf.jsPDF;
      const html2canvas = global.html2canvas;
      const win = iframe && iframe.contentWindow;
      if (!jsPdfCtor || typeof html2canvas !== "function" || !win) {
        alert("Não foi possível carregar o gerador de PDF.");
        return;
      }
      await whenImagesReady(win.document);
      const target = win.document.getElementById("peEntityDoc") || win.document.body;
      iframe.style.height = `${Math.max(1400, target.scrollHeight + 80)}px`;
      const pdf = new jsPdfCtor({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 12;
      const pageW = 210;
      const pageH = 297;
      const contentW = pageW - margin * 2;
      const footerSpace = 8;
      const contentH = pageH - margin * 2 - footerSpace;
      const cssW = target.offsetWidth || 1100;
      const pageCssH = (contentH / contentW) * cssW;
      const cuts = pageCuts(target, pageCssH);
      const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 2, useCORS: true, windowWidth: 1100 });
      const scale = canvas.height / Math.max(1, target.scrollHeight);
      const pageCanvas = document.createElement("canvas");
      const ctx = pageCanvas.getContext("2d");
      pageCanvas.width = canvas.width;
      for (let i = 0; i < cuts.length - 1; i += 1) {
        const start = Math.max(0, Math.round(cuts[i] * scale));
        const end = Math.min(canvas.height, Math.round(cuts[i + 1] * scale));
        const sliceH = Math.max(1, end - start);
        if (end <= start) continue;
        pageCanvas.height = sliceH;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const drawH = (sliceH * contentW) / canvas.width;
        if (i > 0) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentW, drawH);
      }
      const total = pdf.internal.getNumberOfPages();
      for (let n = 1; n <= total; n += 1) {
        pdf.setPage(n);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(FOOTER, margin, pageH - 6);
        pdf.text(`Emitido em ${_issuedLabel}`, pageW / 2, pageH - 6, { align: "center" });
        pdf.text(`Página ${n}`, pageW - margin, pageH - 6, { align: "right" });
      }
      const prefix = (_model && _model.filePrefix) || "relatorio";
      const safe = String(((_model && _model.office && _model.office.name) || prefix))
        .trim()
        .toLowerCase()
        .replace(/[^\w]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      pdf.save(`${prefix}-${safe || "parceiro"}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o PDF.");
    } finally {
      if (iframe) iframe.remove();
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Baixar PDF";
      }
    }
  }

  function beforeAction(action) {
    const kind = currentKind();
    const art = kind && kind.id === "financeiras" ? "da" : "do";
    return `Gere o relatório ${art} ${(kind && kind.noun) || "parceiro"} antes de ${action}.`;
  }

  function managerNames(entityId, kind) {
    const mgr = global.partnerManagersService;
    const list = state().partnerManagers || [];
    if (!mgr || !kind || !entityId) return "";
    const rows = mgr.listForParent(list, { partner_id: entityId }, kind.managerKind);
    return (rows || [])
      .map((m) => {
        const name = String((m && m.name) || "").trim();
        if (!name) return "";
        return m.status === "INATIVO" ? `${name} (inativo)` : name;
      })
      .filter(Boolean)
      .join(", ");
  }

  function pageCuts(target, pageCssH) {
    const top0 = target.getBoundingClientRect().top;
    const ranges = Array.from(target.querySelectorAll("[data-pe-keep]"))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top - top0, bottom: rect.bottom - top0 };
      })
      .filter((r) => r.bottom - r.top > 1);
    const total = Math.max(target.scrollHeight || 0, target.getBoundingClientRect().height || 0, 1);
    const cuts = [0];
    let cursor = 0;
    let guard = 0;
    while (cursor < total - 2 && guard < 120) {
      guard += 1;
      const limit = Math.min(total, cursor + pageCssH);
      if (limit >= total - 2) {
        cuts.push(total);
        break;
      }
      const hits = ranges.filter((r) => r.top < limit - 1 && r.bottom > limit + 1 && r.top > cursor + 12);
      hits.sort((a, b) => b.top - a.top);
      let cut = hits.length ? Math.max(cursor + 12, hits[0].top - 2) : limit;
      if (cut <= cursor + 12) cut = limit;
      cuts.push(cut);
      cursor = cut;
    }
    if (cuts[cuts.length - 1] < total) cuts.push(total);
    return cuts;
  }

  async function show(root, filters) {
    bind();
    ensureStyles();
    const token = ++_token;
    setActions(false);
    const kind = currentKind();
    if (!root || !svc() || !linkSvc() || !kind) return;
    const entityId = String((filters && filters.entityId) || "");
    if (!entityId) {
      root.innerHTML = `<p class="notice">${esc(kind.emptyHint)}</p>`;
      return;
    }
    root.innerHTML = `<p class="notice">${esc(kind.loading)}</p>`;
    const st = state();
    const displayFilters = linkSvc().reportFiltersFor(kind.id, filters);
    let linked = linkSvc().linkedVehicles(st.vehicles || [], kind.id, entityId);
    if (displayFilters.financeiraId) {
      const finId = String(displayFilters.financeiraId);
      linked = linked.filter((v) => String((v && v.financeira_id) || "") === finId);
    }
    const reportFilters = Object.assign({}, displayFilters, { financeiraId: "" });
    const common = {
      offices: st.advocacyOffices || [],
      partners: st.partners || [],
      managers: st.advocacyOfficeManagers || [],
    };
    const preloadFilters = Object.assign({}, reportFilters, { faturamento: "", pagamento: "" });
    const candidates = svc().buildOfficeReport(
      Object.assign({}, common, {
        vehicles: linked,
        receivables: [],
        filters: preloadFilters,
        patioFallbackName: "",
      })
    ).vehicles;
    let events = {};
    try {
      events = await loadEvents(candidates.map((r) => r.id).filter(Boolean));
    } catch (_e) {
      events = {};
    }
    if (token !== _token) return;
    _issuedLabel = fmtWhen(new Date());
    const model = svc().buildOfficeReport(
      Object.assign({}, common, {
        vehicles: linked,
        receivables: st.receivables || [],
        filters: reportFilters,
        eventsByVehicle: events,
        patioFallbackName: (st.settings && st.settings.nome_patio) || "",
        classifyReceivable,
      })
    );
    if (token !== _token) return;
    const partner = (st.partners || []).find((p) => String(p.id) === entityId) || null;
    const docInfo = linkSvc().formatDocument(partner && (partner.cpf || partner.cnpj));
    model.title = kind.title;
    model.printTitle = kind.printTitle;
    model.filePrefix = kind.filePrefix;
    model.office = {
      id: entityId,
      name: (partner && String(partner.nome || "").trim()) || "Cadastro removido",
      cnpj: docInfo.value,
      cnpjLabel: docInfo.label,
      managers: managerNames(entityId, kind),
      managerLabel: kind.managerLabel,
    };
    model.filters = displayFilters;
    _model = model;
    _drill = "all";
    _sort = { key: "dataEntrada", dir: "desc" };
    _bucket = svc().suggestOfficeBucket(reportFilters.from, reportFilters.to);
    paint(root);
    setActions(true);
  }

  function paint(root) {
    const y = window.scrollY;
    root.innerHTML = renderHtml(_model);
    window.scrollTo(0, y);
  }

  function onReportClick(e) {
    if (!e.target.closest || !e.target.closest("#peEntityDoc") || !_model) return;
    const drill = e.target.closest("[data-ao-drill]");
    const band = e.target.closest("[data-ao-band]");
    const attn = e.target.closest("[data-ao-attn]");
    const col = e.target.closest("[data-ao-col]");
    const bucket = e.target.closest("[data-ao-bucket]");
    const clear = e.target.closest("[data-ao-clear]");
    let focusDetail = false;
    if (drill) {
      const id = drill.getAttribute("data-ao-drill") || "all";
      _drill = id === "all" || _drill === id ? "all" : id;
      focusDetail = id !== "all" && _drill !== "all";
    } else if (band) {
      const id = `band:${band.getAttribute("data-ao-band")}`;
      _drill = _drill === id ? "all" : id;
      focusDetail = _drill !== "all";
    } else if (attn) {
      const id = attn.getAttribute("data-ao-attn") || "all";
      _drill = _drill === id ? "all" : id;
      focusDetail = _drill !== "all";
    } else if (col) {
      const key = col.getAttribute("data-ao-col");
      if (_sort.key === key) _sort = { key, dir: _sort.dir === "asc" ? "desc" : "asc" };
      else {
        const asc = key === "placa" || key === "veiculo" || key === "gestor" || key === "patio" || key === "situacao";
        _sort = { key, dir: asc ? "asc" : "desc" };
      }
    } else if (bucket) {
      _bucket = bucket.getAttribute("data-ao-bucket") || "month";
    } else if (clear) {
      _drill = "all";
    } else return;
    const root = document.getElementById("peRelatorioRoot");
    if (!root) return;
    paint(root);
    if (focusDetail) document.getElementById("peEntityDetail")?.scrollIntoView({ block: "start" });
  }

  function cancel() {
    _token += 1;
    setActions(false);
  }

  function bind() {
    if (_bound) return;
    _bound = true;
    document.getElementById("pePrintReport")?.addEventListener("click", () => printDoc());
    document.getElementById("pePdfReport")?.addEventListener("click", () => downloadPdf());
    document.addEventListener("click", onReportClick, true);
    bindShell();
  }

  function emptyFilters(from, to) {
    return {
      from: from || "",
      to: to || "",
      entityId: "",
      officeId: "",
      financeiraId: "",
      status: "",
      tipoVeiculo: "",
      situacaoPatio: "",
      entradaFrom: "",
      entradaTo: "",
      saidaFrom: "",
      saidaTo: "",
      managerId: "",
      patioId: "",
      faturamento: "",
      pagamento: "",
    };
  }

  function filtersFor(kindId) {
    if (_filters[kindId]) return _filters[kindId];
    const period = svc() && svc().defaultPeriod ? svc().defaultPeriod() : { from: "", to: "" };
    _filters[kindId] = emptyFilters(period.from, period.to);
    return _filters[kindId];
  }

  function opt(id, label, cur) {
    return `<option value="${esc(id)}"${String(cur) === String(id) ? " selected" : ""}>${esc(label)}</option>`;
  }

  function partnersForKind(kindId) {
    const kind = linkSvc() && linkSvc().kindOf(kindId);
    const cat = global.partnersCadastroService && global.partnersCadastroService.partnerCategoryOfTipo;
    const st = state();
    const byId = new Map();
    (st.partners || []).forEach((p) => {
      if (!p || !p.id) return;
      if (cat && cat(p.tipo) === kindId) byId.set(String(p.id), p);
    });
    if (kind) {
      (st.vehicles || []).forEach((v) => {
        const id = String((v && v[kind.field]) || "");
        if (!id || byId.has(id)) return;
        const p = (st.partners || []).find((x) => String(x.id) === id);
        if (p) byId.set(id, p);
      });
    }
    return Array.from(byId.values()).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  }

  function partnerLabel(p) {
    const nome = String((p && p.nome) || "").trim() || "Sem nome";
    return String(p.status || "ATIVO").toUpperCase() === "INATIVO" ? `${nome} (inativo)` : nome;
  }

  function fillFilters() {
    const kind = currentKind();
    if (!kind || !svc()) return;
    const f = filtersFor(kind.id);
    const st = state();
    const vehicles = st.vehicles || [];
    const partners = st.partners || [];
    const ent = document.getElementById("peRepEntity");
    const entLabel = document.querySelector("label[for='peRepEntity']");
    if (entLabel) entLabel.textContent = kind.entityLabel;
    if (ent) {
      const list = partnersForKind(kind.id);
      if (f.entityId && !list.some((p) => String(p.id) === String(f.entityId))) f.entityId = "";
      ent.innerHTML =
        opt("", kind.selectPlaceholder, f.entityId) + list.map((p) => opt(p.id, partnerLabel(p), f.entityId)).join("");
    }
    const off = document.getElementById("peRepOffice");
    if (off) {
      const offices = (st.advocacyOffices || []).slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
      off.innerHTML =
        opt("", "Todos", f.officeId) +
        opt("__sem__", "Sem escritório informado", f.officeId) +
        offices.map((o) => opt(o.id, o.name, f.officeId)).join("");
    }
    const mgr = document.getElementById("peRepManager");
    if (mgr) {
      const all = st.advocacyOfficeManagers || [];
      const list = f.officeId && f.officeId !== "__sem__" ? svc().managersForOffice(all, f.officeId) : all.slice();
      mgr.innerHTML =
        opt("", "Todos", f.managerId) +
        list
          .slice()
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"))
          .map((m) => opt(m.id, m.active === false ? `${m.name} (inativo)` : m.name, f.managerId))
          .join("");
    }
    const pat = document.getElementById("peRepPatio");
    if (pat) {
      const ids = new Map();
      partners.forEach((p) => {
        if (String(p.tipo || "").toUpperCase().indexOf("PATIO") >= 0) ids.set(String(p.id), p.nome || p.id);
      });
      vehicles.forEach((v) => {
        const id = String(v.patio_parceiro_id || "");
        if (!id || ids.has(id)) return;
        const p = partners.find((x) => String(x.id) === id);
        ids.set(id, (p && p.nome) || id);
      });
      pat.innerHTML =
        opt("", "Todos", f.patioId) +
        Array.from(ids.entries())
          .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "pt-BR"))
          .map(([id, nome]) => opt(id, nome, f.patioId))
          .join("");
    }
    const fin = document.getElementById("peRepFinanceira");
    if (fin) {
      const list = partnersForKind("financeiras");
      if (f.financeiraId && !list.some((p) => String(p.id) === String(f.financeiraId))) f.financeiraId = "";
      fin.innerHTML = opt("", "Todas", f.financeiraId) + list.map((p) => opt(p.id, partnerLabel(p), f.financeiraId)).join("");
    }
    const tp = document.getElementById("peRepTipo");
    if (tp) {
      tp.innerHTML = opt("", "Todos", f.tipoVeiculo) + svc().uniqueTipos(vehicles).map((t) => opt(t, t, f.tipoVeiculo)).join("");
    }
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };
    setVal("peRepFrom", f.from);
    setVal("peRepTo", f.to);
    setVal("peRepEntradaFrom", f.entradaFrom);
    setVal("peRepEntradaTo", f.entradaTo);
    setVal("peRepSaidaFrom", f.saidaFrom);
    setVal("peRepSaidaTo", f.saidaTo);
    setVal("peRepStatus", f.status);
    setVal("peRepSituacao", f.situacaoPatio);
    setVal("peRepFaturamento", f.faturamento);
    setVal("peRepPagamento", f.pagamento);
    const patioWrap = document.getElementById("peRepPatioWrap");
    const finWrap = document.getElementById("peRepFinWrap");
    if (patioWrap) patioWrap.classList.toggle("hidden", !!kind.hidePatio);
    if (finWrap) finWrap.classList.toggle("hidden", !!kind.hideFinanceira);
  }

  function readFilters() {
    const kind = currentKind();
    if (!kind) return null;
    const f = filtersFor(kind.id);
    const read = (id) => document.getElementById(id)?.value || "";
    f.from = read("peRepFrom");
    f.to = read("peRepTo");
    f.entityId = read("peRepEntity");
    f.officeId = read("peRepOffice");
    f.managerId = read("peRepManager");
    f.patioId = kind.hidePatio ? "" : read("peRepPatio");
    f.financeiraId = kind.hideFinanceira ? "" : read("peRepFinanceira");
    f.status = read("peRepStatus");
    f.tipoVeiculo = read("peRepTipo");
    f.situacaoPatio = read("peRepSituacao");
    f.entradaFrom = read("peRepEntradaFrom");
    f.entradaTo = read("peRepEntradaTo");
    f.saidaFrom = read("peRepSaidaFrom");
    f.saidaTo = read("peRepSaidaTo");
    f.faturamento = read("peRepFaturamento");
    f.pagamento = read("peRepPagamento");
    return f;
  }

  function renderReport() {
    const kind = currentKind();
    const root = document.getElementById("peRelatorioRoot");
    if (!kind || !root) return;
    ensureStyles();
    fillFilters();
    if (!_generated[kind.id]) {
      setActions(false);
      root.innerHTML = `<p class="notice">${kind.hint}</p>`;
      return;
    }
    const filters = readFilters();
    void show(root, filters);
  }

  function applySub() {
    const kind = currentKind();
    const wrap = document.getElementById("partnerCadastroWrap");
    const panel = document.getElementById("partnerEntityReportPanel");
    const report = !!kind && _sub === "relatorio";
    document.querySelectorAll("#partnerEntitySubnav [data-pe-sub]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-pe-sub") === (report ? "relatorio" : "cadastro"));
    });
    if (wrap) wrap.classList.toggle("hidden", report);
    if (panel) {
      panel.classList.toggle("hidden", !report);
      panel.hidden = !report;
    }
    if (report) renderReport();
    else cancel();
  }

  function syncCategory(category) {
    const next = linkSvc() && linkSvc().kindOf(category) ? String(category) : "";
    if (next !== _kindId) {
      _sub = "cadastro";
      cancel();
    }
    _kindId = next;
    const subnav = document.getElementById("partnerEntitySubnav");
    const wrap = document.getElementById("partnerCadastroWrap");
    const panel = document.getElementById("partnerEntityReportPanel");
    const tab = document.getElementById("peReportTab");
    if (!next) {
      cancel();
      if (subnav) {
        subnav.classList.add("hidden");
        subnav.hidden = true;
      }
      if (wrap) wrap.classList.remove("hidden");
      if (panel) {
        panel.classList.add("hidden");
        panel.hidden = true;
      }
      return;
    }
    if (subnav) {
      subnav.classList.remove("hidden");
      subnav.hidden = false;
    }
    if (tab) tab.textContent = linkSvc().kindOf(next).tabLabel;
    _sub = "cadastro";
    applySub();
  }

  function bindShell() {
    document.getElementById("partnerEntitySubnav")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pe-sub]");
      if (!button || !currentKind()) return;
      _sub = button.getAttribute("data-pe-sub") || "cadastro";
      applySub();
    });
    document.getElementById("peGenerateReport")?.addEventListener("click", () => {
      const kind = currentKind();
      if (!kind) return;
      readFilters();
      _generated[kind.id] = true;
      renderReport();
    });
    document.getElementById("peRepOffice")?.addEventListener("change", () => {
      const f = readFilters();
      if (!f || !svc()) return;
      if (f.managerId && f.officeId && f.officeId !== "__sem__") {
        const managers = state().advocacyOfficeManagers || [];
        if (!svc().managerBelongsToOffice(f.managerId, f.officeId, managers)) f.managerId = "";
      }
      fillFilters();
    });
  }

  global.partnerEntityReportUi = {
    show,
    cancel,
    bind,
    syncCategory,
    print: printDoc,
    downloadPdf,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})(typeof window !== "undefined" ? window : globalThis);
