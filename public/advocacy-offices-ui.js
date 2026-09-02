/**
 * Cadastro de escritórios, seletor no veículo e relatório de demanda.
 */
(function advocacyOfficesUiModule(global) {
  "use strict";

  let _styles = false;
  let _bound = false;
  let _cadastroFilters = { search: "", status: "" };
  let _editingId = null;
  let _readonly = false;
  let _reportFilters = null;
  let _reportSort = { by: "demandas", dir: "desc" };
  let _reportChartPreset = "6m";
  let _detailOfficeId = "";
  let _detailSearch = "";
  let _generated = false;

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

  function canManage() {
    return !global.isGestorPista && !global.isVistoriador;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR");
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  }

  function injectStyles() {
    if (_styles) return;
    _styles = true;
    if (document.getElementById("advocacyOfficesUiStyles")) return;
    const style = document.createElement("style");
    style.id = "advocacyOfficesUiStyles";
    style.textContent = `
      .ao-suggest { position: absolute; z-index: 40; left: 0; right: 0; top: 100%;
        max-height: 220px; overflow: auto; margin-top: 4px; border-radius: 10px;
        border: 1px solid rgba(148,163,184,.25); background: #0f172a; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
      [data-theme="light"] .ao-suggest { background: #fff; }
      .ao-suggest button { display: block; width: 100%; text-align: left; background: transparent;
        border: 0; color: inherit; padding: 8px 12px; font-size: .84rem; cursor: pointer; }
      .ao-suggest button:hover, .ao-suggest button[aria-selected="true"] { background: rgba(56,189,248,.12); }
      .ao-picker { position: relative; }
      .ao-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 12px 0; }
      .ao-kpi { padding: 14px; border-radius: 12px; border: 1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.4); }
      [data-theme="light"] .ao-kpi { background: #fff; }
      .ao-kpi span { display: block; font-size: .72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; }
      .ao-kpi strong { font-size: 1.25rem; }
      .ao-rank tr[data-ao-office] { cursor: pointer; }
      .ao-chart { display: flex; align-items: flex-end; gap: 8px; min-height: 140px; padding: 8px 4px 0; }
      .ao-bar { flex: 1; min-width: 18px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; }
      .ao-bar i { display: block; width: 100%; max-width: 36px; border-radius: 6px 6px 0 0; background: linear-gradient(180deg,#38bdf8,#0284c7); min-height: 4px; }
      .ao-bar em { font-style: normal; font-size: .7rem; color: #94a3b8; text-align: center; }
      .ao-sit { display: flex; flex-wrap: wrap; gap: 8px; }
      .ao-sit .ao-kpi { min-width: 120px; flex: 1; }
      .ao-toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      #aoOfficeModal .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
      #aoOfficeModal .form-grid .full { grid-column: 1 / -1; }
      @media (max-width: 720px) {
        #aoOfficeModal .form-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function ctxData() {
    const st = global.__ampliState || {};
    return {
      offices: st.advocacyOffices || [],
      vehicles: st.vehicles || [],
      partners: st.partners || [],
      inspectionIndex: st.inspectionIndex || {},
    };
  }

  function renderCadastro() {
    const root = document.getElementById("aoCadastroRoot");
    if (!root || !svc()) return;
    injectStyles();
    const { offices, vehicles } = ctxData();
    const list = svc().filterOffices(offices, _cadastroFilters);
    const manage = canManage();
    root.innerHTML =
      `<div class="filter-bar" style="margin:0 0 12px">
        <label for="aoCadastroSearch">Pesquisar</label>
        <input id="aoCadastroSearch" type="search" placeholder="Nome, CNPJ, responsável…" value="${esc(_cadastroFilters.search)}" />
        <label for="aoCadastroStatus">Status</label>
        <select id="aoCadastroStatus">
          <option value="">Todos</option>
          <option value="ATIVO"${_cadastroFilters.status === "ATIVO" ? " selected" : ""}>Ativo</option>
          <option value="INATIVO"${_cadastroFilters.status === "INATIVO" ? " selected" : ""}>Inativo</option>
        </select>
      </div>
      <div class="table-wrap">
        <table class="table stacked">
          <thead><tr>
            <th>Nome</th><th>CNPJ</th><th>Responsável</th><th>Telefone</th><th>Status</th><th>Demandas</th><th>Ações</th>
          </tr></thead>
          <tbody>${
            list.length
              ? list
                  .map((o) => {
                    const n = svc().linkedVehicleCount(vehicles, o.id);
                    const st = o.active ? '<span class="pc-status-ativo">Ativo</span>' : '<span class="pc-status-inativo">Inativo</span>';
                    const toggle = o.active ? "Inativar" : "Ativar";
                    const del = n
                      ? `<button type="button" class="secondary" disabled title="Há ${n} vínculo(s)">Excluir</button>`
                      : `<button type="button" class="secondary" data-ao-del="${esc(o.id)}">Excluir</button>`;
                    const edits = manage
                      ? `<button type="button" class="secondary" data-ao-edit="${esc(o.id)}">Editar</button>
                         <button type="button" class="secondary" data-ao-toggle="${esc(o.id)}">${toggle}</button>
                         ${del}`
                      : "";
                    return `<tr>
                      <td data-label="Nome">${esc(o.name)}</td>
                      <td data-label="CNPJ">${esc(o.cnpj || "—")}</td>
                      <td data-label="Responsável">${esc(o.responsible_name || "—")}</td>
                      <td data-label="Telefone">${esc(o.phone || o.whatsapp || "—")}</td>
                      <td data-label="Status">${st}</td>
                      <td data-label="Demandas">${n}</td>
                      <td data-label="Ações" class="actions">
                        <button type="button" class="secondary" data-ao-view="${esc(o.id)}">Visualizar</button>
                        ${edits}
                      </td>
                    </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="7" class="notice" style="text-align:center;padding:18px">Nenhum escritório cadastrado.</td></tr>`
          }</tbody>
        </table>
      </div>`;
    const novo = document.getElementById("aoOpenCreate");
    if (novo) novo.classList.toggle("hidden", !manage);
  }

  function fillOfficeForm(office, readonly) {
    _editingId = office?.id || null;
    _readonly = !!readonly;
    const title = document.getElementById("aoOfficeModalTitle");
    if (title) {
      title.textContent = readonly ? "Visualizar escritório" : office?.id ? "Editar escritório" : "Novo escritório";
    }
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val || "";
      el.disabled = !!readonly;
    };
    set("aoFieldName", office?.name);
    set("aoFieldCnpj", office?.cnpj);
    set("aoFieldResponsible", office?.responsible_name);
    set("aoFieldPhone", office?.phone);
    set("aoFieldWhatsapp", office?.whatsapp);
    set("aoFieldEmail", office?.email);
    set("aoFieldNotes", office?.notes);
    const st = document.getElementById("aoFieldActive");
    if (st) {
      st.value = office && office.active === false ? "INATIVO" : "ATIVO";
      st.disabled = !!readonly;
    }
    const err = document.getElementById("aoOfficeFormErrors");
    if (err) {
      err.classList.add("hidden");
      err.innerHTML = "";
    }
    const save = document.getElementById("aoOfficeSave");
    if (save) save.classList.toggle("hidden", !!readonly);
    document.getElementById("aoOfficeModal")?.classList.remove("hidden");
  }

  function readOfficeForm() {
    return svc().normalizeOfficePayload({
      name: document.getElementById("aoFieldName")?.value,
      cnpj: document.getElementById("aoFieldCnpj")?.value,
      responsible_name: document.getElementById("aoFieldResponsible")?.value,
      phone: document.getElementById("aoFieldPhone")?.value,
      whatsapp: document.getElementById("aoFieldWhatsapp")?.value,
      email: document.getElementById("aoFieldEmail")?.value,
      notes: document.getElementById("aoFieldNotes")?.value,
      active: document.getElementById("aoFieldActive")?.value !== "INATIVO",
    });
  }

  function closeOfficeModal() {
    document.getElementById("aoOfficeModal")?.classList.add("hidden");
    _editingId = null;
    _readonly = false;
  }

  function currentReportFilters() {
    if (_reportFilters) return _reportFilters;
    const d = svc().defaultPeriod();
    _reportFilters = {
      from: d.from,
      to: d.to,
      officeId: "",
      financeiraId: "",
      status: "",
      tipoVeiculo: "",
      situacaoPatio: "",
    };
    return _reportFilters;
  }

  function fillReportFilterOptions() {
    const { offices, vehicles, partners } = ctxData();
    const f = currentReportFilters();
    const opt = (id, label, cur) =>
      `<option value="${esc(id)}"${String(cur) === String(id) ? " selected" : ""}>${esc(label)}</option>`;
    const off = document.getElementById("aoRepOffice");
    if (off) {
      off.innerHTML =
        opt("", "Todos", f.officeId) +
        opt("__sem__", "Sem escritório informado", f.officeId) +
        (offices || [])
          .slice()
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"))
          .map((o) => opt(o.id, o.name, f.officeId))
          .join("");
    }
    const fin = document.getElementById("aoRepFinanceira");
    if (fin) {
      const ids = new Map();
      (vehicles || []).forEach((v) => {
        const id = String(v.responsavel_financeiro_id || v.localizador_id || "");
        if (!id || ids.has(id)) return;
        const p = (partners || []).find((x) => String(x.id) === id);
        ids.set(id, p?.nome || v.responsavel_financeiro_nome || id);
      });
      fin.innerHTML =
        opt("", "Todas", f.financeiraId) +
        Array.from(ids.entries())
          .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
          .map(([id, nome]) => opt(id, nome, f.financeiraId))
          .join("");
    }
    const st = document.getElementById("aoRepStatus");
    if (st) {
      st.innerHTML =
        opt("", "Todos", f.status) +
        svc()
          .uniqueStatuses(vehicles)
          .map((s) => opt(s, svc().STATUS_LABELS[s] || s, f.status))
          .join("");
    }
    const tp = document.getElementById("aoRepTipo");
    if (tp) {
      tp.innerHTML =
        opt("", "Todos", f.tipoVeiculo) +
        svc()
          .uniqueTipos(vehicles)
          .map((t) => opt(t, t, f.tipoVeiculo))
          .join("");
    }
    const from = document.getElementById("aoRepFrom");
    const to = document.getElementById("aoRepTo");
    if (from) from.value = f.from || "";
    if (to) to.value = f.to || "";
    const sit = document.getElementById("aoRepSituacao");
    if (sit) sit.value = f.situacaoPatio || "";
  }

  function readReportFiltersFromDom() {
    _reportFilters = {
      from: document.getElementById("aoRepFrom")?.value || "",
      to: document.getElementById("aoRepTo")?.value || "",
      officeId: document.getElementById("aoRepOffice")?.value || "",
      financeiraId: document.getElementById("aoRepFinanceira")?.value || "",
      status: document.getElementById("aoRepStatus")?.value || "",
      tipoVeiculo: document.getElementById("aoRepTipo")?.value || "",
      situacaoPatio: document.getElementById("aoRepSituacao")?.value || "",
    };
    return _reportFilters;
  }

  function sortRanking(rows) {
    const { by, dir } = _reportSort;
    const mul = dir === "asc" ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const va = a[by];
      const vb = b[by];
      if (typeof va === "string" || typeof vb === "string") {
        return mul * String(va || "").localeCompare(String(vb || ""), "pt-BR");
      }
      return mul * ((Number(va) || 0) - (Number(vb) || 0));
    });
  }

  function renderKpis(k) {
    return `<div class="ao-kpis">
      <div class="ao-kpi"><span>Total de demandas</span><strong>${k.total}</strong></div>
      <div class="ao-kpi"><span>No pátio</span><strong>${k.noPatio}</strong></div>
      <div class="ao-kpi"><span>Baixados</span><strong>${k.baixados}</strong></div>
      <div class="ao-kpi"><span>Pendentes</span><strong>${k.pendentes}</strong></div>
      <div class="ao-kpi"><span>Tempo médio</span><strong>${k.tempoMedio} dias</strong></div>
    </div>`;
  }

  function renderChart(series) {
    const max = Math.max(1, ...series.map((s) => s.count));
    return `<div class="ao-chart" aria-label="Demanda por mês">${series
      .map((s) => {
        const h = Math.round((s.count / max) * 120);
        return `<div class="ao-bar"><strong>${s.count}</strong><i style="height:${h}px"></i><em>${esc(s.label.slice(0, 3))}</em></div>`;
      })
      .join("")}</div>`;
  }

  function renderReport() {
    const root = document.getElementById("aoRelatorioRoot");
    if (!root || !svc()) return;
    injectStyles();
    fillReportFilterOptions();
    if (!_generated) {
      root.innerHTML = `<p class="notice">Defina os filtros e clique em <strong>Gerar relatório</strong>.</p>`;
      return;
    }
    const data = ctxData();
    const filters = currentReportFilters();
    const chartRange = svc().chartRange(
      _reportChartPreset,
      _reportChartPreset === "custom" ? filters.from : "",
      _reportChartPreset === "custom" ? filters.to : ""
    );
    const report = svc().computeReport({
      vehicles: data.vehicles,
      offices: data.offices,
      partners: data.partners,
      inspectionIndex: data.inspectionIndex,
      filters,
    });
    const chartReport = svc().computeReport({
      vehicles: data.vehicles,
      offices: data.offices,
      partners: data.partners,
      inspectionIndex: data.inspectionIndex,
      filters: Object.assign({}, filters, { from: chartRange.from, to: chartRange.to }),
    });
    const ranking = sortRanking(report.ranking);
    const th = (key, label) => {
      const mark = _reportSort.by === key ? (_reportSort.dir === "asc" ? " ▲" : " ▼") : "";
      return `<th><button type="button" class="secondary" data-ao-sort="${key}" style="padding:2px 8px">${esc(label)}${mark}</button></th>`;
    };
    let detailOffice = null;
    let detailKpis = report.kpis;
    let detailRows = report.detail;
    if (_detailOfficeId) {
      detailOffice = (data.offices || []).find((o) => String(o.id) === String(_detailOfficeId));
      const oid = _detailOfficeId === "__sem__" ? "" : _detailOfficeId;
      detailRows = report.detail.filter((r) =>
        _detailOfficeId === "__sem__" ? !r.officeId : String(r.officeId) === String(oid)
      );
      detailKpis = svc().kpisOf(
        svc().filterDemandVehicles(
          data.vehicles,
          data.partners,
          Object.assign({}, filters, { officeId: _detailOfficeId })
        ),
        filters.to
      );
    }
    const q = _detailSearch.trim().toLowerCase();
    if (q) {
      detailRows = detailRows.filter((r) =>
        `${r.placa} ${r.veiculo} ${r.financeira} ${r.status} ${r.observacoes}`.toLowerCase().includes(q)
      );
    }
    const finTable = (detailOffice ? svc().computeReport({
      vehicles: data.vehicles,
      offices: data.offices,
      partners: data.partners,
      inspectionIndex: data.inspectionIndex,
      filters: Object.assign({}, filters, { officeId: _detailOfficeId }),
    }).financeiras : report.financeiras);

    root.innerHTML =
      `<div id="aoReportCapture">
        ${renderKpis(report.kpis)}
        <div class="ao-toolbar-actions" style="margin:0 0 12px">
          <button type="button" class="secondary" data-ao-export="excel">Exportar Excel</button>
          <button type="button" class="secondary" data-ao-export="pdf">Gerar PDF</button>
          <button type="button" class="secondary" data-ao-export="print">Imprimir</button>
        </div>
        <section class="section-card" style="margin-bottom:14px">
          <h3 style="margin:0 0 8px">Ranking de escritórios</h3>
          <div class="table-wrap">
            <table class="table stacked ao-rank">
              <thead><tr>
                ${th("nome", "Escritório")}${th("demandas", "Demandas")}${th("noPatio", "No pátio")}
                ${th("baixados", "Baixados")}${th("pendentes", "Pendentes")}${th("pct", "% do total")}
              </tr></thead>
              <tbody>${
                ranking.length
                  ? ranking
                      .map(
                        (r) => `<tr data-ao-office="${esc(r.officeId || "__sem__")}">
                          <td data-label="Escritório">${esc(r.nome)}</td>
                          <td data-label="Demandas">${r.demandas}</td>
                          <td data-label="No pátio">${r.noPatio}</td>
                          <td data-label="Baixados">${r.baixados}</td>
                          <td data-label="Pendentes">${r.pendentes}</td>
                          <td data-label="%">${r.pct}%</td>
                        </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="6" class="notice" style="text-align:center;padding:16px">Nenhuma demanda no período.</td></tr>`
              }</tbody>
            </table>
          </div>
        </section>
        <section class="section-card" style="margin-bottom:14px">
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;justify-content:space-between">
            <h3 style="margin:0">Gráfico de demanda</h3>
            <label>Período do gráfico
              <select id="aoChartPreset">
                <option value="6m"${_reportChartPreset === "6m" ? " selected" : ""}>Últimos 6 meses</option>
                <option value="12m"${_reportChartPreset === "12m" ? " selected" : ""}>Últimos 12 meses</option>
                <option value="year"${_reportChartPreset === "year" ? " selected" : ""}>Ano atual</option>
                <option value="custom"${_reportChartPreset === "custom" ? " selected" : ""}>Período personalizado</option>
              </select>
            </label>
          </div>
          ${renderChart(chartReport.chart)}
        </section>
        <section class="section-card" style="margin-bottom:14px">
          <h3 style="margin:0 0 8px">Demanda por situação</h3>
          <div class="ao-sit">${report.situacoes
            .map((s) => `<div class="ao-kpi"><span>${esc(s.label)}</span><strong>${s.quantidade}</strong></div>`)
            .join("")}</div>
        </section>
        ${_detailOfficeId
          ? `<section class="section-card" style="margin-bottom:14px">
              <h3 style="margin:0 0 6px">${esc(detailOffice?.name || "Sem escritório informado")}</h3>
              <p class="notice" style="margin:0 0 10px">Total: ${detailKpis.total} · No pátio: ${detailKpis.noPatio} · Baixados: ${detailKpis.baixados} · Pendentes: ${detailKpis.pendentes} · Tempo médio: ${detailKpis.tempoMedio} dias</p>
              <h4 style="margin:12px 0 8px">Demanda por financeira</h4>
              <div class="table-wrap"><table class="table"><thead><tr><th>Financeira</th><th>Quantidade</th></tr></thead>
              <tbody>${finTable.map((x) => `<tr><td>${esc(x.nome)}</td><td>${x.quantidade}</td></tr>`).join("") || `<tr><td colspan="2">—</td></tr>`}</tbody></table></div>
              <label style="display:block;margin:12px 0 8px">Pesquisar nos veículos
                <input type="search" id="aoDetailSearch" value="${esc(_detailSearch)}" placeholder="Placa, veículo, financeira…" />
              </label>
              <div class="table-wrap">
                <table class="table stacked">
                  <thead><tr>
                    <th>Data de entrada</th><th>Veículo</th><th>Placa</th><th>Financeira</th>
                    <th>Status</th><th>Data de baixa</th><th>Dias no pátio</th><th>Situação</th><th>Vistoria</th><th>Observações</th>
                  </tr></thead>
                  <tbody>${
                    detailRows.length
                      ? detailRows
                          .map(
                            (r) => `<tr>
                              <td data-label="Entrada">${esc(fmtDate(r.dataEntrada))}</td>
                              <td data-label="Veículo">${esc(r.veiculo)}</td>
                              <td data-label="Placa">${esc(r.placa)}</td>
                              <td data-label="Financeira">${esc(r.financeira)}</td>
                              <td data-label="Status">${esc(r.status)}</td>
                              <td data-label="Baixa">${esc(fmtDate(r.dataBaixa))}</td>
                              <td data-label="Dias">${r.dias}</td>
                              <td data-label="Situação">${esc(r.situacao)}</td>
                              <td data-label="Vistoria">${esc(r.vistoria)}</td>
                              <td data-label="Observações">${esc(r.observacoes || "—")}</td>
                            </tr>`
                          )
                          .join("")
                      : `<tr><td colspan="10" class="notice" style="text-align:center;padding:16px">Nenhum veículo neste escritório.</td></tr>`
                  }</tbody>
                </table>
              </div>
            </section>`
          : `<section class="section-card">
              <h3 style="margin:0 0 8px">Demanda por financeira (visão geral)</h3>
              <div class="table-wrap"><table class="table"><thead><tr><th>Financeira</th><th>Quantidade</th></tr></thead>
              <tbody>${report.financeiras.map((x) => `<tr><td>${esc(x.nome)}</td><td>${x.quantidade}</td></tr>`).join("") || `<tr><td colspan="2">—</td></tr>`}</tbody></table></div>
              <p class="notice" style="margin:10px 0 0">Clique em um escritório no ranking para ver o detalhamento.</p>
            </section>`}
      </div>`;
  }

  function filterSummary() {
    const f = currentReportFilters();
    const { offices, partners } = ctxData();
    const bits = [];
    bits.push(`Período: ${fmtDate(f.from)} a ${fmtDate(f.to)}`);
    if (f.officeId) bits.push(`Escritório: ${svc().officeName(f.officeId === "__sem__" ? "" : f.officeId, offices)}`);
    if (f.financeiraId) {
      const p = (partners || []).find((x) => String(x.id) === String(f.financeiraId));
      bits.push(`Financeira: ${p?.nome || f.financeiraId}`);
    }
    if (f.status) bits.push(`Status: ${svc().STATUS_LABELS[f.status] || f.status}`);
    if (f.tipoVeiculo) bits.push(`Tipo: ${f.tipoVeiculo}`);
    if (f.situacaoPatio) bits.push(`Situação: ${f.situacaoPatio}`);
    return bits.join(" · ");
  }

  function downloadBlob(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function exportExcel() {
    const data = ctxData();
    const report = svc().computeReport({
      vehicles: data.vehicles,
      offices: data.offices,
      partners: data.partners,
      inspectionIndex: data.inspectionIndex,
      filters: currentReportFilters(),
    });
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [];
    lines.push(["Escritório", "Demandas", "No pátio", "Baixados", "Pendentes", "%"].map(cell).join(";"));
    report.ranking.forEach((r) =>
      lines.push([r.nome, r.demandas, r.noPatio, r.baixados, r.pendentes, `${r.pct}%`].map(cell).join(";"))
    );
    lines.push("");
    lines.push(
      ["Data entrada", "Veículo", "Placa", "Financeira", "Status", "Data baixa", "Dias", "Situação", "Vistoria", "Escritório", "Observações"]
        .map(cell)
        .join(";")
    );
    report.detail.forEach((r) =>
      lines.push(
        [fmtDate(r.dataEntrada), r.veiculo, r.placa, r.financeira, r.status, fmtDate(r.dataBaixa), r.dias, r.situacao, r.vistoria, r.officeName, r.observacoes].map(cell).join(";")
      )
    );
    downloadBlob("demanda-por-escritorio.xls", "application/vnd.ms-excel;charset=utf-8", "\ufeff" + lines.join("\r\n"));
  }

  async function exportPdfOrPrint(mode) {
    const capture = document.getElementById("aoReportCapture");
    if (!capture) return;
    const logo = document.getElementById("brandLogo")?.src || "/assets/ampliguard-header-trim.png";
    const now = new Date().toLocaleString("pt-BR");
    const k = svc().computeReport({
      vehicles: ctxData().vehicles,
      offices: ctxData().offices,
      partners: ctxData().partners,
      inspectionIndex: ctxData().inspectionIndex,
      filters: currentReportFilters(),
    }).kpis;
    const header =
      `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <img src="${esc(logo)}" alt="AMPLIGUARD" style="height:42px" />
        <div><h2 style="margin:0">Demanda por Escritório</h2>
        <p style="margin:4px 0 0;font-size:12px">${esc(filterSummary())}<br/>Gerado em ${esc(now)}</p></div>
      </div>
      <p style="font-size:13px">Total ${k.total} · Pátio ${k.noPatio} · Baixados ${k.baixados} · Pendentes ${k.pendentes} · Tempo médio ${k.tempoMedio} dias</p>`;
    if (mode === "print") {
      const html = `<!DOCTYPE html><html><head><title>Demanda por Escritório</title>
        <style>body{font-family:system-ui,sans-serif;padding:16px;color:#0f172a} table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #cbd5e1;padding:6px;text-align:left} h3{margin:16px 0 8px}</style></head>
        <body>${header}${capture.innerHTML}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 2000);
      return;
    }
    if (typeof global.loadJsPdf === "function") await global.loadJsPdf();
    const jsPdfCtor = global.jspdf?.jsPDF;
    if (!jsPdfCtor) {
      alert("Não foi possível carregar o gerador de PDF.");
      return;
    }
    if (typeof global.loadHtml2Canvas === "function") {
      const html2canvas = await global.loadHtml2Canvas();
      const wrap = document.createElement("div");
      wrap.style.background = "#fff";
      wrap.style.color = "#0f172a";
      wrap.style.padding = "16px";
      wrap.innerHTML = header + capture.innerHTML;
      document.body.appendChild(wrap);
      const canvas = await html2canvas(wrap, { backgroundColor: "#ffffff", scale: 1.4, useCORS: true });
      wrap.remove();
      const pdf = new jsPdfCtor({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 16;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 8;
      let remain = imgH;
      let srcY = 0;
      const pageCanvasH = ((pageH - 16) * canvas.width) / imgW;
      while (remain > 0) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(pageCanvasH, canvas.height - srcY);
        slice.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        if (srcY > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", 0.82), "JPEG", 8, y, imgW, (slice.height * imgW) / canvas.width);
        srcY += slice.height;
        remain -= pageH - 16;
        y = 8;
      }
      pdf.save("demanda-por-escritorio.pdf");
      return;
    }
    alert("html2canvas indisponível para gerar o PDF.");
  }

  function bindPicker(input, hidden, listEl, opts) {
    if (!input || !hidden || !listEl || !svc()) return;
    const onlyActive = opts?.onlyActive !== false;
    const renderList = () => {
      const offices = (global.__ampliState?.advocacyOffices || []).filter((o) => (onlyActive ? o.active : true) || String(o.id) === String(hidden.value));
      const hits = svc().searchOffices(offices, input.value, { onlyActive: false });
      if (!hits.length) {
        listEl.innerHTML = `<button type="button" data-ao-pick="">Sem escritório informado</button>`;
        listEl.classList.remove("hidden");
        return;
      }
      listEl.innerHTML =
        `<button type="button" data-ao-pick="">Sem escritório informado</button>` +
        hits.map((o) => `<button type="button" data-ao-pick="${esc(o.id)}">${esc(o.name)}${o.cnpj ? ` · ${esc(o.cnpj)}` : ""}</button>`).join("");
      listEl.classList.remove("hidden");
    };
    const apply = (id) => {
      hidden.value = id || "";
      if (!id) input.value = "";
      else {
        const o = (global.__ampliState?.advocacyOffices || []).find((x) => String(x.id) === String(id));
        input.value = o?.name || "";
      }
      listEl.classList.add("hidden");
      if (typeof opts?.onChange === "function") opts.onChange(hidden.value || null);
    };
    input.addEventListener("focus", renderList);
    input.addEventListener("input", renderList);
    input.addEventListener("blur", () => setTimeout(() => listEl.classList.add("hidden"), 180));
    listEl.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("[data-ao-pick]");
      if (!btn) return;
      e.preventDefault();
      apply(btn.getAttribute("data-ao-pick") || "");
    });
    apply(hidden.value || "");
  }

  function bindOnce() {
    if (_bound) return;
    _bound = true;
    injectStyles();
    document.getElementById("aoOpenCreate")?.addEventListener("click", () => {
      if (!canManage()) return;
      fillOfficeForm(null, false);
    });
    document.getElementById("aoOfficeForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (_readonly || !canManage()) return;
      const payload = readOfficeForm();
      const errors = svc().validateOffice(payload, global.__ampliState?.advocacyOffices || [], _editingId);
      const errBox = document.getElementById("aoOfficeFormErrors");
      if (errors.length) {
        if (errBox) {
          errBox.classList.remove("hidden");
          errBox.innerHTML = `<ul>${errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
        }
        return;
      }
      if (typeof global.saveAdvocacyOffice === "function") {
        const ok = await global.saveAdvocacyOffice(_editingId, payload);
        if (ok) closeOfficeModal();
      }
    });
    document.getElementById("aoCancelOffice")?.addEventListener("click", closeOfficeModal);
    document.getElementById("aoCloseOfficeModal")?.addEventListener("click", closeOfficeModal);
    document.getElementById("aoCadastroRoot")?.addEventListener("input", (e) => {
      if (e.target.id === "aoCadastroSearch") {
        _cadastroFilters.search = e.target.value || "";
        renderCadastro();
        const el = document.getElementById("aoCadastroSearch");
        if (el) {
          el.focus();
          const n = el.value.length;
          el.setSelectionRange(n, n);
        }
      }
    });
    document.getElementById("aoCadastroRoot")?.addEventListener("change", (e) => {
      if (e.target.id === "aoCadastroStatus") {
        _cadastroFilters.status = e.target.value || "";
        renderCadastro();
      }
    });
    document.getElementById("aoCadastroRoot")?.addEventListener("click", async (e) => {
      const view = e.target.closest("[data-ao-view]");
      const edit = e.target.closest("[data-ao-edit]");
      const tog = e.target.closest("[data-ao-toggle]");
      const del = e.target.closest("[data-ao-del]");
      const offices = global.__ampliState?.advocacyOffices || [];
      if (view) {
        const o = offices.find((x) => String(x.id) === view.getAttribute("data-ao-view"));
        if (o) fillOfficeForm(o, true);
      }
      if (edit && canManage()) {
        const o = offices.find((x) => String(x.id) === edit.getAttribute("data-ao-edit"));
        if (o) fillOfficeForm(o, false);
      }
      if (tog && canManage() && typeof global.toggleAdvocacyOffice === "function") {
        await global.toggleAdvocacyOffice(tog.getAttribute("data-ao-toggle"));
      }
      if (del && canManage() && typeof global.deleteAdvocacyOffice === "function") {
        await global.deleteAdvocacyOffice(del.getAttribute("data-ao-del"));
      }
    });
    document.getElementById("aoGenerateReport")?.addEventListener("click", () => {
      readReportFiltersFromDom();
      _generated = true;
      _detailOfficeId = currentReportFilters().officeId || "";
      renderReport();
    });
    document.getElementById("aoRelatorioRoot")?.addEventListener("click", (e) => {
      const sortBtn = e.target.closest("[data-ao-sort]");
      if (sortBtn) {
        const key = sortBtn.getAttribute("data-ao-sort");
        if (_reportSort.by === key) _reportSort.dir = _reportSort.dir === "asc" ? "desc" : "asc";
        else {
          _reportSort.by = key;
          _reportSort.dir = key === "nome" ? "asc" : "desc";
        }
        renderReport();
        return;
      }
      const exp = e.target.closest("[data-ao-export]");
      if (exp) {
        const kind = exp.getAttribute("data-ao-export");
        if (kind === "excel") exportExcel();
        else exportPdfOrPrint(kind === "print" ? "print" : "pdf");
        return;
      }
      const row = e.target.closest("[data-ao-office]");
      if (row) {
        _detailOfficeId = row.getAttribute("data-ao-office") || "";
        renderReport();
      }
    });
    document.getElementById("aoRelatorioRoot")?.addEventListener("change", (e) => {
      if (e.target.id === "aoChartPreset") {
        _reportChartPreset = e.target.value || "6m";
        renderReport();
      }
    });
    document.getElementById("aoRelatorioRoot")?.addEventListener("input", (e) => {
      if (e.target.id === "aoDetailSearch") {
        _detailSearch = e.target.value || "";
        renderReport();
        const el = document.getElementById("aoDetailSearch");
        if (el) {
          el.focus();
          const n = el.value.length;
          el.setSelectionRange(n, n);
        }
      }
    });
  }

  function setSubview(sub) {
    const cad = sub !== "relatorio";
    document.querySelectorAll("#escritoriosSubnav [data-ao-sub]").forEach((btn) => {
      const isRep = btn.getAttribute("data-ao-sub") === "relatorio";
      btn.classList.toggle("active", cad ? !isRep : isRep);
    });
    document.getElementById("aoCadastroPanel")?.classList.toggle("hidden", !cad);
    document.getElementById("aoRelatorioPanel")?.classList.toggle("hidden", cad);
    if (cad) renderCadastro();
    else {
      fillReportFilterOptions();
      renderReport();
    }
  }

  function openReport(opts) {
    _generated = true;
    const d = svc().defaultPeriod();
    _reportFilters = Object.assign({ from: d.from, to: d.to, officeId: "", financeiraId: "", status: "", tipoVeiculo: "", situacaoPatio: "" }, opts || {});
    _detailOfficeId = _reportFilters.officeId || "";
    setSubview("relatorio");
  }

  function renderDashboardWidget(host, data) {
    if (!host || !svc()) return;
    const rows = svc()
      .rankingRows(data.vehicles || [], data.offices || [], data.partners || [], { from: "", to: "" })
      .filter((r) => r.officeId && r.demandas)
      .slice(0, 5);
    if (!rows.length) {
      host.innerHTML = `<section class="section-card"><h3 style="margin:0 0 8px">Demanda por escritório</h3><p class="notice" style="margin:0">Ainda não há escritórios vinculados às demandas.</p></section>`;
      return;
    }
    host.innerHTML = `<section class="section-card">
      <h3 style="margin:0 0 8px">Demanda por escritório</h3>
      <ol style="margin:0;padding-left:1.2rem;line-height:1.7">
        ${rows
          .map(
            (r, i) =>
              `<li><button type="button" class="secondary" data-ao-dash="${esc(r.officeId)}" style="padding:2px 8px">${i + 1}. ${esc(r.nome)} — ${r.demandas}</button></li>`
          )
          .join("")}
      </ol>
    </section>`;
    host.querySelectorAll("[data-ao-dash]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof global.openAdvocacyDemandReport === "function") {
          global.openAdvocacyDemandReport({ officeId: btn.getAttribute("data-ao-dash") });
        }
      });
    });
  }

  global.advocacyOfficesUi = {
    bindOnce,
    renderCadastro,
    renderReport,
    setSubview,
    openReport,
    bindPicker,
    fillOfficeForm,
    renderDashboardWidget,
  };
})(typeof window !== "undefined" ? window : globalThis);
