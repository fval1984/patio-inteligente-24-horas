/**
 * Relatório detalhado de escritório — tela, impressão e PDF.
 * Usa o mesmo HTML do documento. Não grava nem altera veículos, pátio ou financeiro.
 */
(function advocacyOfficeReportUi(global) {
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

  function svc() {
    return global.advocacyOfficesService;
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
    ["aoPrintReport", "aoPdfReport"].forEach((id) => {
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
    return `<article class="ao-doc" id="aoOfficeDoc">
      <div class="ao-doc-head" data-ao-block>
        <img src="${esc(LOGO)}" alt="AMPLIGUARD" />
        <h1>RELATÓRIO DETALHADO DE ESCRITÓRIO</h1>
        <p class="ao-office-name">${esc(dash(office.name))}</p>
        <p>CNPJ: ${esc(dash(office.cnpj))}</p>
        <p>Gestor(es) de Carteira: ${esc(dash(office.managers))}</p>
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
      <h2 id="aoOfficeDetail" data-ao-block>Relação detalhada dos veículos</h2>
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
    #aoOfficeDoc.ao-doc { background:#fff; color:#0f2744; font-family:"Segoe UI", system-ui, sans-serif; padding:16px 16px 8px; border:1px solid #e2e8f0; border-radius:12px; }
    #aoOfficeDoc .ao-doc-head { display:block; text-align:center; background:#fff; color:#0f2744; border-bottom:3px solid #b91c1c; padding:0 0 12px; margin:0 0 14px; }
    #aoOfficeDoc .ao-doc-head img { display:block; margin:0 auto 8px; height:64px; width:auto; max-width:280px; max-height:64px; object-fit:contain; }
    #aoOfficeDoc .ao-doc-head h1 { display:block; margin:10px 0 6px; font-size:16pt; letter-spacing:.02em; color:#0f2744; background:transparent; }
    #aoOfficeDoc .ao-doc-head p { display:block; margin:2px 0; font-size:10.5pt; color:#0f2744; }
    .ao-office-name { font-size:13pt !important; font-weight:700; }
    .ao-filters { color:#475569; font-size:9.5pt !important; }
    .ao-doc h2 { margin:16px 0 8px; font-size:12.5pt; border-bottom:1px solid #e2e8f0; padding-bottom:4px; page-break-after:avoid; }
    .ao-note { margin:0 0 8px; color:#475569; font-size:9pt; }
    .ao-empty { margin:8px 0 12px; }
    .ao-table { width:100%; border-collapse:collapse; margin:0 0 12px; }
    .ao-table th, .ao-table td { border:1px solid #cbd5e1; padding:5px 6px; text-align:left; vertical-align:top; font-size:8.5pt; }
    .ao-table th { background:#f1f5f9; font-size:8pt; }
    .ao-fin { font-size:8pt; }
    .ao-veh { border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; margin:0 0 8px; page-break-inside:avoid; break-inside:avoid; }
    .ao-veh h3 { margin:0; font-size:11pt; }
    .ao-stage { margin:2px 0 6px; font-weight:700; color:#9f1239; font-size:9.5pt; }
    .ao-fields { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; }
    .ao-fields div { font-size:9pt; }
    .ao-fields span { color:#64748b; }
    #aoOfficeDoc .ao-cards { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:8px; margin:0 0 12px; }
    #aoOfficeDoc .ao-card { display:block; width:100%; text-align:left; background:#f8fafc; border:1px solid #dbe3ee; border-radius:10px; padding:10px 12px; color:#0f2744; font:inherit; cursor:pointer; }
    #aoOfficeDoc div.ao-card { cursor:default; }
    #aoOfficeDoc .ao-card strong { display:block; font-size:16pt; line-height:1.15; }
    #aoOfficeDoc .ao-card.ao-money strong { font-size:12.5pt; }
    #aoOfficeDoc .ao-card span { display:block; margin-top:4px; color:#475569; font-size:8.5pt; }
    #aoOfficeDoc .ao-card.ao-on, #aoOfficeDoc .ao-band.ao-on, #aoOfficeDoc .ao-attn.ao-on { border-color:#0f766e; background:#f0fdfa; box-shadow:inset 0 0 0 1px #0f766e; }
    #aoOfficeDoc .ao-switch { display:flex; gap:6px; margin:0 0 8px; }
    #aoOfficeDoc .ao-bucket, #aoOfficeDoc .ao-sort, #aoOfficeDoc .ao-screen-only button { font:inherit; }
    #aoOfficeDoc .ao-bucket { border:1px solid #cbd5e1; background:#fff; border-radius:999px; padding:4px 12px; cursor:pointer; color:#0f2744; }
    #aoOfficeDoc .ao-bucket.ao-on { background:#0f766e; color:#fff; border-color:#0f766e; }
    #aoOfficeDoc .ao-print-label { display:none; color:#475569; font-size:9pt; }
    #aoOfficeDoc .ao-chart { margin:0 0 8px; }
    #aoOfficeDoc .ao-svg { display:block; width:100%; max-width:1040px; height:auto; }
    #aoOfficeDoc .ao-legend { display:flex; flex-wrap:wrap; gap:10px 16px; margin:6px 0; font-size:9pt; color:#334155; }
    #aoOfficeDoc .ao-legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:4px; }
    #aoOfficeDoc .ao-bands, #aoOfficeDoc .ao-attns, #aoOfficeDoc .ao-stages { display:grid; gap:6px; margin:0 0 12px; }
    #aoOfficeDoc .ao-stages { grid-template-columns:repeat(4, minmax(0, 1fr)); }
    #aoOfficeDoc .ao-attns { grid-template-columns:repeat(3, minmax(0, 1fr)); }
    #aoOfficeDoc .ao-band { display:grid; grid-template-columns:150px 1fr 36px; gap:8px; align-items:center; width:100%; text-align:left; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:6px 8px; font:inherit; color:#0f2744; cursor:pointer; }
    #aoOfficeDoc .ao-bar { display:block; height:10px; background:#e2e8f0; border-radius:999px; overflow:hidden; }
    #aoOfficeDoc .ao-bar i { display:block; height:10px; background:#0f766e; border-radius:999px; }
    #aoOfficeDoc .ao-stage-card, #aoOfficeDoc .ao-attn { background:#f8fafc; border:1px solid #dbe3ee; border-radius:10px; padding:10px 12px; text-align:left; color:#0f2744; }
    #aoOfficeDoc .ao-attn { width:100%; font:inherit; cursor:pointer; }
    #aoOfficeDoc .ao-attn.ao-muted { cursor:default; opacity:.72; }
    #aoOfficeDoc .ao-stage-card strong, #aoOfficeDoc .ao-attn strong { display:block; font-size:14pt; }
    #aoOfficeDoc .ao-stage-card span, #aoOfficeDoc .ao-attn span, #aoOfficeDoc .ao-stage-card small, #aoOfficeDoc .ao-attn small { display:block; margin-top:3px; color:#475569; font-size:8.5pt; }
    #aoOfficeDoc .ao-sort { background:transparent; border:0; padding:0; font-weight:700; color:inherit; cursor:pointer; text-align:left; }
    #aoOfficeDoc .ao-sort.ao-on { color:#0f766e; }
    #aoOfficeDoc .ao-banner { background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; padding:8px 10px; margin:0 0 8px; }
    #aoOfficeDoc button.ao-card,
    #aoOfficeDoc button.ao-band,
    #aoOfficeDoc button.ao-attn,
    #aoOfficeDoc button.ao-clear {
      background:#f8fafc !important;
      color:#0f2744 !important;
      border:1px solid #dbe3ee !important;
      box-shadow:none !important;
      min-height:0 !important;
      letter-spacing:0 !important;
      text-transform:none !important;
    }
    #aoOfficeDoc button.ao-card strong,
    #aoOfficeDoc button.ao-band strong,
    #aoOfficeDoc button.ao-attn strong { color:#0f2744 !important; }
    #aoOfficeDoc button.ao-card span,
    #aoOfficeDoc button.ao-band span,
    #aoOfficeDoc button.ao-attn span,
    #aoOfficeDoc button.ao-card small,
    #aoOfficeDoc button.ao-attn small { color:#475569 !important; }
    #aoOfficeDoc button.ao-card.ao-on,
    #aoOfficeDoc button.ao-band.ao-on,
    #aoOfficeDoc button.ao-attn.ao-on { background:#f0fdfa !important; border-color:#0f766e !important; }
    #aoOfficeDoc button.ao-bucket { background:#fff !important; color:#0f2744 !important; border:1px solid #cbd5e1 !important; box-shadow:none !important; min-height:0 !important; letter-spacing:0 !important; border-radius:999px !important; padding:4px 12px !important; }
    #aoOfficeDoc button.ao-bucket.ao-on { background:#0f766e !important; color:#fff !important; border-color:#0f766e !important; }
    #aoOfficeDoc button.ao-sort { background:transparent !important; color:#334155 !important; border:0 !important; box-shadow:none !important; min-height:0 !important; letter-spacing:0 !important; padding:0 !important; border-radius:0 !important; }
    #aoOfficeDoc button.ao-sort.ao-on { color:#0f766e !important; }
    #aoOfficeDoc button.ao-card:hover,
    #aoOfficeDoc button.ao-band:hover,
    #aoOfficeDoc button.ao-attn:hover,
    #aoOfficeDoc button.ao-bucket:hover,
    #aoOfficeDoc button.ao-sort:hover { transform:none; }
    #aoOfficeDoc .ao-foot-screen, #aoOfficeDoc .ao-foot-print { display:flex; justify-content:space-between; gap:8px; margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; color:#64748b; font-size:8.5pt; background:#fff; position:static; }
    #aoOfficeDoc .ao-foot-print { display:none; }
    @media print {
      .ao-doc { border:0; border-radius:0; padding:0 0 16mm; }
      .ao-screen-only { display:none !important; }
      .ao-print-label { display:inline !important; }
      .ao-foot-screen { display:none !important; }
      .ao-foot-print { display:flex !important; position:fixed; left:0; right:0; bottom:0; margin:0; padding:4px 0; background:#fff; }
      .ao-page-num::after { content: counter(page); }
      thead { display:table-header-group; }
      tr, .ao-veh, .ao-doc-head, .ao-chart, .ao-cards, .ao-bands, .ao-stages, .ao-attns { break-inside:avoid; page-break-inside:avoid; }
      h2 { break-after:avoid; page-break-after:avoid; }
    }
  `;

  function ensureStyles() {
    let style = document.getElementById("aoOfficeReportStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "aoOfficeReportStyles";
      document.head.appendChild(style);
    }
    if (style.textContent !== DOC_CSS) style.textContent = DOC_CSS;
  }

  function docEl() {
    return document.getElementById("aoOfficeDoc");
  }

  function printDoc() {
    const doc = docEl();
    if (!doc) {
      alert("Gere o relatório do escritório antes de imprimir.");
      return;
    }
    const origin = global.location && global.location.origin ? global.location.origin : "";
    const html = doc.outerHTML.replace(LOGO, origin + LOGO);
    const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório detalhado de escritório</title>
      <style>${DOC_CSS} @page { margin: 12mm; }</style></head><body>${html}</body></html>`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Relatório de escritório");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1100px;height:1400px;border:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      alert("Não foi possível preparar a impressão neste navegador.");
      return;
    }
    win.document.open();
    win.document.write(page);
    win.document.close();
    const imgs = Array.from(win.document.images || []);
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
    Promise.race([ready, timeout]).then(() => {
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
    const doc = docEl();
    if (!doc) {
      alert("Gere o relatório do escritório antes de baixar o PDF.");
      return;
    }
    const btn = document.getElementById("aoPdfReport");
    const prev = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Gerando PDF…";
    }
    try {
      if (typeof global.loadJsPdf === "function") await global.loadJsPdf();
      if (typeof global.loadHtml2Canvas === "function") await global.loadHtml2Canvas();
      const jsPdfCtor = global.jspdf && global.jspdf.jsPDF;
      const html2canvas = global.html2canvas;
      if (!jsPdfCtor || typeof html2canvas !== "function") {
        alert("Não foi possível carregar o gerador de PDF.");
        return;
      }
      await renderPdf(doc, jsPdfCtor, html2canvas);
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar o PDF.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || "Baixar PDF";
      }
    }
  }

  function blockHeight(el) {
    const rect = el.getBoundingClientRect();
    const cs = global.getComputedStyle(el);
    const mt = parseFloat(cs.marginTop) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    return Math.ceil(rect.height + mt + mb);
  }

  async function renderPdf(doc, jsPdfCtor, html2canvas) {
    const widthPx = 1120;
    const marginMm = 8;
    const footerMm = 8;
    const pageW = 297;
    const pageH = 210;
    const contentW = pageW - marginMm * 2;
    const contentH = pageH - marginMm * 2 - footerMm;
    const sandbox = document.createElement("div");
    sandbox.style.cssText = `position:fixed;left:0;top:0;width:${widthPx}px;background:#fff;z-index:-1;pointer-events:none;`;
    sandbox.innerHTML = doc.outerHTML;
    document.body.appendChild(sandbox);
    const imgs = Array.from(sandbox.querySelectorAll("img"));
    await Promise.all(
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
    sandbox.querySelectorAll(".ao-screen-only").forEach((el) => el.remove());
    sandbox.querySelectorAll(".ao-print-label").forEach((el) => {
      el.style.display = "inline";
    });
    sandbox.querySelectorAll(".ao-foot-screen, .ao-foot-print").forEach((el) => el.remove());
    const pxPerMm = widthPx / contentW;
    const maxPx = Math.floor(contentH * pxPerMm) - 6;
    const items = [];
    sandbox.querySelectorAll("[data-ao-block]").forEach((el) => {
      if (el.tagName === "TR") {
        const table = el.closest("table");
        const thead = table ? table.querySelector("thead") : null;
        items.push({
          type: "row",
          el,
          h: Math.max(1, blockHeight(el)),
          thead,
          theadH: thead ? Math.max(1, blockHeight(thead)) : 0,
          table,
        });
      } else {
        items.push({ type: "block", el, h: Math.max(1, blockHeight(el)) });
      }
    });
    const pages = [];
    let page = [];
    let used = 0;
    let lastTable = null;
    const flush = () => {
      if (page.length) pages.push(page);
      page = [];
      used = 0;
      lastTable = null;
    };
    items.forEach((item) => {
      let need = item.h;
      let prefix = null;
      if (item.type === "row" && item.thead) {
        if (used === 0 || lastTable !== item.table) {
          need += item.theadH;
          prefix = item.thead;
        }
      }
      if (used > 0 && used + need > maxPx) {
        flush();
        if (item.type === "row" && item.thead) {
          need = item.h + item.theadH;
          prefix = item.thead;
        }
      }
      if (item.h > maxPx && used === 0 && !prefix) {
        page.push(item.el);
        flush();
        return;
      }
      if (prefix) {
        page.push(prefix);
        used += item.theadH;
      }
      page.push(item.el);
      used += item.h;
      if (item.type === "row") lastTable = item.table;
    });
    flush();

    const pdf = new jsPdfCtor({ orientation: "landscape", unit: "mm", format: "a4" });
    try {
    for (let i = 0; i < pages.length; i += 1) {
      const wrap = document.createElement("div");
      wrap.className = "ao-doc";
      wrap.style.width = `${widthPx}px`;
      wrap.style.padding = "0";
      wrap.style.border = "0";
      wrap.style.borderRadius = "0";
      let table = null;
      pages[i].forEach((el) => {
        if (el.tagName === "THEAD" || el.tagName === "TR") {
          if (!table) {
            table = document.createElement("table");
            table.className = "ao-table";
            wrap.appendChild(table);
          }
          if (el.tagName === "THEAD") table.appendChild(el.cloneNode(true));
          else {
            let body = table.querySelector("tbody");
            if (!body) {
              body = document.createElement("tbody");
              table.appendChild(body);
            }
            body.appendChild(el.cloneNode(true));
          }
        } else {
          table = null;
          wrap.appendChild(el.cloneNode(true));
        }
      });
      sandbox.appendChild(wrap);
      const canvas = await html2canvas(wrap, { backgroundColor: "#ffffff", scale: 1.5, useCORS: true });
      wrap.remove();
      const imgH = (canvas.height * contentW) / canvas.width;
      const drawH = Math.min(imgH, contentH);
      const drawW = imgH > contentH ? contentW * (contentH / imgH) : contentW;
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", marginMm, marginMm, drawW, drawH);
    }
    const total = pdf.internal.getNumberOfPages();
    for (let n = 1; n <= total; n += 1) {
      pdf.setPage(n);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(FOOTER, marginMm, pageH - 5);
      pdf.text(`Emitido em ${_issuedLabel}`, pageW / 2, pageH - 5, { align: "center" });
      pdf.text(`Página ${n} de ${total}`, pageW - marginMm, pageH - 5, { align: "right" });
    }
    } finally {
      sandbox.remove();
    }
    const safe = String((doc.querySelector(".ao-office-name") || {}).textContent || "escritorio")
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    pdf.save(`relatorio-escritorio-${safe || "escritorio"}.pdf`);
  }

  async function show(root, filters) {
    bind();
    ensureStyles();
    const token = ++_token;
    setActions(false);
    if (!root || !svc()) return;
    const officeId = String((filters && filters.officeId) || "");
    if (!officeId) {
      root.innerHTML = `<p class="notice">Selecione um escritório para gerar o relatório detalhado.</p>`;
      return;
    }
    root.innerHTML = `<p class="notice">Montando o relatório do escritório…</p>`;
    const st = state();
    const preloadFilters = Object.assign({}, filters, { faturamento: "", pagamento: "" });
    const candidates = svc().buildOfficeReport({
      vehicles: st.vehicles || [],
      offices: st.advocacyOffices || [],
      partners: st.partners || [],
      managers: st.advocacyOfficeManagers || [],
      receivables: [],
      filters: preloadFilters,
      patioFallbackName: "",
    }).vehicles;
    let events = {};
    try {
      events = await loadEvents(candidates.map((r) => r.id).filter(Boolean));
    } catch (_e) {
      events = {};
    }
    if (token !== _token) return;
    _issuedLabel = fmtWhen(new Date());
    const model = svc().buildOfficeReport({
      vehicles: st.vehicles || [],
      offices: st.advocacyOffices || [],
      partners: st.partners || [],
      managers: st.advocacyOfficeManagers || [],
      receivables: st.receivables || [],
      filters,
      eventsByVehicle: events,
      patioFallbackName: (st.settings && st.settings.nome_patio) || "",
      classifyReceivable,
    });
    if (token !== _token) return;
    _model = model;
    _drill = "all";
    _sort = { key: "dataEntrada", dir: "desc" };
    _bucket = svc().suggestOfficeBucket(filters.from, filters.to);
    paint(root);
    setActions(true);
  }

  function paint(root) {
    const y = window.scrollY;
    root.innerHTML = renderHtml(_model);
    window.scrollTo(0, y);
  }

  function onReportClick(e) {
    if (!e.target.closest || !e.target.closest("#aoOfficeDoc") || !_model) return;
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
    const root = document.getElementById("aoRelatorioRoot");
    if (!root) return;
    paint(root);
    if (focusDetail) document.getElementById("aoOfficeDetail")?.scrollIntoView({ block: "start" });
  }

  function cancel() {
    _token += 1;
    setActions(false);
  }

  function bind() {
    if (_bound) return;
    _bound = true;
    document.getElementById("aoPrintReport")?.addEventListener("click", () => printDoc());
    document.getElementById("aoPdfReport")?.addEventListener("click", () => downloadPdf());
    document.addEventListener("click", onReportClick, true);
  }

  global.advocacyOfficeReport = { show, cancel, bind, print: printDoc, downloadPdf };
})(typeof window !== "undefined" ? window : globalThis);
