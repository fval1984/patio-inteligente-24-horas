/**
 * Recibo de pagamento — Financeiro → Entradas.
 *
 * O que grava no RECIBO (snapshot), e não no veículo nem no lançamento:
 * pagador, CPF/CNPJ, parceiro, instituição, escritório, placa, marca/modelo,
 * RPP, localizador, datas e horas de estadia, serviços, desconto, acréscimo,
 * observações e responsável exibido.
 *
 * O que pode gravar no LANÇAMENTO de Entradas (tabela receivables), somente
 * se o usuário marcar e confirmar:
 * valor, forma_pagamento e data_pagamento no meta do título.
 *
 * Não altera vehicles, partners, cash_movements nem o fluxo
 * Aguardando Faturamento → CDF → Entradas → Caixa.
 */
(function () {
  const LOGO = "/assets/ampliguard-header-system-trim.png?v=20261005recibo1";
  const PHOTO = "/assets/ampliguard-recibo-patio.jpg?v=20261005recibo1";
  const FORMAS = ["Dinheiro", "PIX", "Cartão Débito", "Cartão Crédito", "Transferência", "Boleto", "Cheque"];

  let draft = null;
  let existing = null;
  let qrDataUrl = "";

  function appState() {
    return window.__ampliState || null;
  }

  function db() {
    return typeof supabase !== "undefined" ? supabase : null;
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toCents(value) {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return 0;
      return Math.round(value * 100);
    }
    return parseMoney(value);
  }

  function parseMoney(str) {
    let s = String(str || "")
      .trim()
      .replace(/\s/g, "")
      .replace(/R\$/gi, "");
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function fromCents(cents) {
    return (Number(cents) || 0) / 100;
  }

  function lineTotalCents(qtd, unitCents) {
    const q = Math.round(Number(qtd) * 1000);
    const unit = Math.round(Number(unitCents) || 0);
    if (!Number.isFinite(q)) return 0;
    return Math.round((q * unit) / 1000);
  }

  function totals(d) {
    const sum = (d?.servicos || []).reduce((acc, line) => acc + lineTotalCents(line.qtd, line.unitCents), 0);
    const desc = Math.max(0, Math.round(Number(d?.descontoCents) || 0));
    const acres = Math.max(0, Math.round(Number(d?.acrescimoCents) || 0));
    return { sum, desc, acres, total: sum - desc + acres };
  }

  function money(cents) {
    const value = fromCents(cents);
    if (typeof formatCurrency === "function") return formatCurrency(value);
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function centsToInput(cents) {
    return fromCents(cents).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseQty(str) {
    const n = Number(String(str || "").trim().replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function ymdOf(value) {
    if (!value) return "";
    const s = String(value).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function clockOf(value) {
    if (!value) return "";
    const s = String(value);
    if (!/[T ]\d{2}:\d{2}/.test(s)) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function showDate(ymdVal) {
    const m = String(ymdVal || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "—";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function randomToken() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function newLineId() {
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function maskPlate(placa) {
    const p = String(placa || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    if (p.length < 4) return "****";
    return `${p.slice(0, 3)}${"*".repeat(Math.max(2, p.length - 4))}${p.slice(-1)}`;
  }

  function validationUrl(token) {
    return `${location.origin}/recibo-validar.html?t=${encodeURIComponent(token || "")}`;
  }

  function isPaid(receivable) {
    if (!receivable) return false;
    if (typeof recebimentoPagamentoConfirmado === "function") return !!recebimentoPagamentoConfirmado(receivable);
    const st = String(receivable.status || "").toUpperCase();
    return st === "PAGO" || st === "RECEBIDO" || st === "QUITADO" || st === "BAIXADO";
  }

  function findReceivable(id) {
    return (appState()?.receivables || []).find((r) => String(r.id) === String(id)) || null;
  }

  function findVehicle(receivable) {
    const id = receivable?.vehicle_id;
    if (!id) return null;
    return (appState()?.vehicles || []).find((v) => String(v.id) === String(id)) || null;
  }

  function partnerNome(id) {
    if (!id) return "";
    return String((appState()?.partners || []).find((p) => String(p.id) === String(id))?.nome || "").trim();
  }

  function companyBits() {
    const s = appState()?.settings || {};
    const cnpj = typeof reciboCnpjExibicao === "function" ? reciboCnpjExibicao(s) : String(s.cnpj || "").trim();
    return {
      razao: "AMPLIGUARD GUARDA E CUSTÓDIA DE BENS LTDA",
      cnpj: cnpj || "—",
      tel: String(s.recibo_telefone || "").trim() || "(81) 99991-8484",
      endereco: String(s.endereco || "").trim() || "Rua Marquês de Baipendi, 119 — Campo Grande – Recife/PE",
      email: String(s.email || s.recibo_email || "").trim() || "contato@ampliguard.com.br",
      site: "www.ampliguard.com.br",
      local: `Pátio ${(s.nome_patio || "AMPLIGUARD").trim() || "AMPLIGUARD"}`,
    };
  }

  function operatorName() {
    if (typeof currentPatioOperatorLabel === "function") return currentPatioOperatorLabel() || "";
    return appState()?.user?.email || "";
  }

  function blankDraft() {
    return {
      pagadorNome: "",
      pagadorDoc: "",
      parceiro: "",
      instituicao: "",
      escritorio: "",
      placa: "",
      marcaModelo: "",
      rpp: "",
      localizador: "",
      entradaYmd: "",
      entradaHora: "",
      saidaYmd: "",
      saidaHora: "",
      diarias: 0,
      local: companyBits().local,
      servicos: [],
      descontoCents: 0,
      acrescimoCents: 0,
      formaPagamento: "PIX",
      pagamentoYmd: "",
      pagamentoHora: "",
      observacoes: "",
      responsavel: "",
      pago: false,
      numero: "",
      token: "",
      statusDoc: "PREVIA",
      receiptId: "",
      receivableId: "",
      vehicleId: "",
      atualizarOficial: false,
    };
  }

  function buildDraft(receivable) {
    const d = blankDraft();
    const vehicle = findVehicle(receivable);
    const st = appState();
    d.receivableId = receivable?.id || "";
    d.vehicleId = receivable?.vehicle_id || "";
    d.pago = isPaid(receivable);
    d.token = randomToken();

    const fat = typeof faturamentoRealRecebimento === "function" ? faturamentoRealRecebimento(receivable, vehicle) : null;
    const ident = window.financeReceivableDevedorIdentity ? window.financeReceivableDevedorIdentity(receivable) : null;
    d.pagadorNome = String(fat?.nome || ident?.nome || "").trim();
    d.pagadorDoc = String(fat?.doc || "").trim();
    d.parceiro = window.financeReceberRppNome ? String(window.financeReceberRppNome(receivable, vehicle) || "") : "";
    if (d.parceiro === "—") d.parceiro = "";
    d.instituicao = partnerNome(vehicle?.financeira_id);
    d.escritorio =
      vehicle && typeof vehicleAdvocacyOfficeNome === "function" ? String(vehicleAdvocacyOfficeNome(vehicle) || "") : "";
    if (d.escritorio === "—") d.escritorio = "";
    d.placa = String(vehicle?.placa || "").trim();
    d.marcaModelo = [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ").trim();
    d.rpp = d.parceiro;
    d.localizador = window.financeVehicleRpvNome ? String(window.financeVehicleRpvNome(vehicle) || "") : "";
    if (d.localizador === "—") d.localizador = "";

    const entrada = vehicle?.data_entrada || receivable?.period_start || "";
    const saida = vehicle?.data_saida || receivable?.period_end || "";
    d.entradaYmd = ymdOf(entrada);
    d.entradaHora = clockOf(vehicle?.data_entrada || entrada);
    d.saidaYmd = ymdOf(saida);
    d.saidaHora = clockOf(vehicle?.data_saida || saida);

    const br =
      vehicle && typeof receivableFinanceBreakdown === "function" ? receivableFinanceBreakdown(receivable, vehicle) : null;
    const dias = Number(br?.dias || 0);
    const valorDiaria = Number(br?.valorDiaria ?? br?.valor_diaria ?? vehicle?.valor_diaria ?? 0);
    const remocao = Number(br?.taxaRemocao ?? br?.taxa_remocao ?? 0);
    const extras = Number(br?.taxasAdicionais ?? br?.taxas_adicionais ?? 0);
    d.diarias = dias;

    if (dias > 0 && valorDiaria > 0) {
      d.servicos.push({
        id: newLineId(),
        descricao: "Guarda e custódia / estadias",
        qtd: dias,
        unitCents: toCents(valorDiaria),
      });
    }
    if (remocao > 0) {
      d.servicos.push({
        id: newLineId(),
        descricao: "Remoção do veículo",
        qtd: 1,
        unitCents: toCents(remocao),
      });
    }
    if (extras > 0) {
      d.servicos.push({
        id: newLineId(),
        descricao: "Outros serviços",
        qtd: 1,
        unitCents: toCents(extras),
      });
    }

    const oficial = toCents(
      d.pago && typeof valorPagoRecebimento === "function"
        ? valorPagoRecebimento(receivable)
        : Number(receivable?.valor || 0)
    );
    if (!d.servicos.length) {
      const label =
        typeof financeReceivableDisplayText === "function" ? financeReceivableDisplayText(receivable) : "Serviço de pátio";
      d.servicos.push({
        id: newLineId(),
        descricao: label && label !== "—" ? label : "Serviço de pátio",
        qtd: dias > 0 ? dias : 1,
        unitCents: dias > 0 ? Math.round(oficial / dias) : oficial,
      });
    }
    const base = totals(d).sum;
    if (oficial > base) d.acrescimoCents = oficial - base;
    else if (oficial < base) d.descontoCents = base - oficial;

    const movs = typeof entradasCaixaDoRecebimento === "function" ? entradasCaixaDoRecebimento(receivable) : [];
    const mov = movs[0] || null;
    d.formaPagamento =
      (typeof formaPagamentoRegistrada === "function" && formaPagamentoRegistrada(receivable, mov)) ||
      (typeof financeReceivableFormaPagamento === "function" && financeReceivableFormaPagamento(receivable)) ||
      "PIX";
    d.pagamentoYmd =
      typeof dataPagamentoYmdRecebimento === "function" ? dataPagamentoYmdRecebimento(receivable, mov) || "" : ymdOf(mov?.data_movimento);
    d.pagamentoHora = clockOf(mov?.created_at || "");
    if (typeof financeReceivableMetaText === "function" && typeof financeMetaUnpack === "function") {
      const unpacked = financeMetaUnpack(financeReceivableMetaText(receivable));
      const text = String(unpacked?.meta?.observacoes_texto || unpacked?.text || "").trim();
      if (text && !text.includes("[[finmeta:")) d.observacoes = text;
    }
    if (d.pago) d.responsavel = operatorName();
    d.local = companyBits().local;
    void st;
    return d;
  }

  function applyRow(row, receivable) {
    const snap = row?.snapshot && typeof row.snapshot === "object" ? row.snapshot : {};
    const d = { ...blankDraft(), ...snap };
    d.servicos = Array.isArray(snap.servicos) ? snap.servicos.map((line) => ({ ...line })) : [];
    d.receiptId = row.id;
    d.numero = row.numero || "";
    d.token = row.token || d.token || randomToken();
    d.statusDoc = row.status || "PREVIA";
    d.pago = isPaid(receivable);
    d.receivableId = receivable?.id || row.receivable_id;
    d.vehicleId = receivable?.vehicle_id || row.vehicle_id || "";
    d.atualizarOficial = false;
    d.descontoCents = Math.round(Number(d.descontoCents) || 0);
    d.acrescimoCents = Math.round(Number(d.acrescimoCents) || 0);
    d.servicos.forEach((line) => {
      line.unitCents = Math.round(Number(line.unitCents) || 0);
      line.qtd = Number(line.qtd) || 0;
      if (!line.id) line.id = newLineId();
    });
    return d;
  }

  function periodoLabel(d) {
    const stay = (d.servicos || []).find((s) => /estadia|diária|diaria|custódia|custodia/i.test(s.descricao || ""));
    const q = stay ? Number(stay.qtd) : Number(d.diarias || 0);
    if (!(q > 0)) return "—";
    const n = Number.isInteger(q) ? String(q) : String(q).replace(".", ",");
    return `${n} ${q === 1 ? "diária" : "diárias"}`;
  }

  function statusBadge(d) {
    if (d.pago) return `<div class="ag-status">✓ PAGO</div>`;
    return `<div class="ag-status ag-status--wait">AGUARDANDO PAGAMENTO</div>`;
  }

  function fact(icon, label, value) {
    return `<div class="ag-fact"><div class="ag-ico">${icon}</div><div><small>${esc(label)}</small><strong>${esc(value || "—")}</strong></div></div>`;
  }

  const ICO = {
    cal: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
    out: `<svg viewBox="0 0 24 24"><path d="M9 6h11v12H9"/><path d="M13 12H4m0 0 3-3m-3 3 3 3"/></svg>`,
    clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></svg>`,
    pin: `<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>`,
    shield: `<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6l-7-3z"/></svg>`,
    lock: `<svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
    truck: `<svg viewBox="0 0 24 24"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/></svg>`,
  };

  function sheetHtml() {
    const d = draft;
    const t = totals(d);
    const co = companyBits();
    const rows = (d.servicos || [])
      .map(
        (line) => `<tr>
          <td>${esc(line.descricao || "—")}</td>
          <td>${esc(formatQty(line.qtd))}</td>
          <td>${esc(money(line.unitCents))}</td>
          <td>${esc(money(lineTotalCents(line.qtd, line.unitCents)))}</td>
        </tr>`
      )
      .join("");
    const adjust = [];
    if (t.desc) adjust.push(`Descontos: ${esc(money(t.desc))}`);
    if (t.acres) adjust.push(`Acréscimos: ${esc(money(t.acres))}`);
    const parceiroBits = [
      d.parceiro ? `Parceiro: ${esc(d.parceiro)}` : "",
      d.escritorio ? `Escritório: ${esc(d.escritorio)}` : "",
      d.instituicao ? `Instituição financeira: ${esc(d.instituicao)}` : "",
    ]
      .filter(Boolean)
      .map((line) => `<p class="ag-line">${line}</p>`)
      .join("");
    const rppLoc = [d.rpp, d.localizador].filter((x) => x && x !== "—").join(" / ") || "—";
    const qr = qrDataUrl
      ? `<img src="${qrDataUrl}" alt="QR Code de autenticação do recibo" />`
      : `<small>${d.token ? "QR Code indisponível neste momento." : "O QR Code é gerado ao salvar."}</small>`;
    const quando = [showDate(d.pagamentoYmd), d.pagamentoHora].filter((x) => x && x !== "—").join(" - ") || "—";
    return `<article class="ag-sheet" id="agReciboPrintRoot">
      ${d.pago ? "" : `<div class="ag-watermark">PRÉVIA</div>`}
      <header class="ag-hero">
        <div class="ag-hero-slash"></div>
        <div class="ag-hero-brand">
          <img class="ag-logo" src="${esc(absUrl(LOGO))}" alt="AMPLIGUARD" />
          <p class="ag-slogan">MAIS QUE UM PÁTIO,<br />UM COMPROMISSO.</p>
        </div>
        <div class="ag-badge">
          <small>RECIBO Nº</small>
          <strong>${esc(d.numero || "——")}</strong>
          ${statusBadge(d)}
        </div>
      </header>
      <div class="ag-hero-gold"></div>
      <div class="ag-body">
        <h1 class="ag-title">RECIBO DE PAGAMENTO</h1>
        <div class="ag-cols">
          <section>
            <h2 class="ag-kicker">DADOS DO PAGADOR</h2>
            <p class="ag-line"><strong>${esc(d.pagadorNome || "—")}</strong></p>
            <p class="ag-line"><span>CPF/CNPJ:</span> ${esc(d.pagadorDoc || "—")}</p>
            ${parceiroBits || `<p class="ag-line">Parceiro: —</p>`}
          </section>
          <section>
            <h2 class="ag-kicker">DADOS DO VEÍCULO</h2>
            <p class="ag-line"><span>Placa:</span> <strong>${esc(d.placa || "—")}</strong></p>
            <p class="ag-line"><span>Marca/Modelo:</span> ${esc(d.marcaModelo || "—")}</p>
            <p class="ag-line"><span>RPP / Localizador:</span> ${esc(rppLoc)}</p>
          </section>
        </div>
        <div class="ag-facts">
          ${fact(ICO.cal, "Entrada", `${showDate(d.entradaYmd)} ${d.entradaHora || ""}`.trim())}
          ${fact(ICO.out, "Saída", `${showDate(d.saidaYmd)} ${d.saidaHora || ""}`.trim())}
          ${fact(ICO.clock, "Período", periodoLabel(d))}
          ${fact(ICO.pin, "Local", d.local || co.local)}
        </div>
        <div class="ag-keep">
          <table class="ag-table">
            <thead><tr><th>DESCRIÇÃO</th><th>QTD.</th><th>VALOR UNIT.</th><th>TOTAL</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4">Nenhum serviço informado.</td></tr>`}</tbody>
          </table>
          ${adjust.length ? `<p class="ag-line" style="margin-top:8px">${adjust.join(" · ")}</p>` : ""}
          <div class="ag-total"><span>TOTAL PAGO</span><strong>${esc(money(t.total))}</strong></div>
        </div>
        <div class="ag-pay">
          <div>
            <h2 class="ag-kicker">FORMA DE PAGAMENTO</h2>
            <strong>${esc(d.formaPagamento || "—")}</strong>
          </div>
          <div>
            <h2 class="ag-kicker">PAGAMENTO REALIZADO EM</h2>
            <strong>${esc(quando)}</strong>
          </div>
          <div class="ag-qr">
            ${qr}
            <small>Documento autenticado via QR Code</small>
          </div>
        </div>
        <p class="ag-declare">Declaramos, para os devidos fins, o recebimento do valor total acima discriminado, referente aos serviços indicados neste documento.</p>
        ${d.observacoes ? `<p class="ag-line" style="margin-top:8px"><span>Observações:</span> ${esc(d.observacoes)}</p>` : ""}
        <div class="ag-sign">
          <div class="line"></div>
          <small>Responsável pelo Recebimento</small>
          <strong>${esc(d.responsavel || "AMPLIGUARD")}</strong>
        </div>
      </div>
      <footer class="ag-foot">
        <div>
          <p><strong>${esc(co.razao)}</strong></p>
          <p>CNPJ: ${esc(co.cnpj)} · ${esc(co.site)}</p>
        </div>
        <div class="ag-marks">
          <div class="ag-mark">${ICO.shield}<span>GUARDA</span></div>
          <div class="ag-mark">${ICO.lock}<span>CUSTÓDIA</span></div>
          <div class="ag-mark">${ICO.truck}<span>REMOÇÃO DE VEÍCULOS</span></div>
        </div>
      </footer>
      <div class="ag-contact">
        <span>${esc(co.tel)}</span>
        <span>${esc(co.email)}</span>
        <span>${esc(co.endereco)}</span>
      </div>
    </article>`;
  }

  function formatQty(qtd) {
    const n = Number(qtd) || 0;
    if (Number.isInteger(n)) return String(n);
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  function absUrl(path) {
    if (!path) return "";
    if (/^(https?:|data:)/i.test(path)) return path;
    return `${location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function editorHtml() {
    const d = draft;
    const formaOpts = FORMAS.map((f) => `<option ${f === d.formaPagamento ? "selected" : ""}>${esc(f)}</option>`).join("");
    const extraForma =
      d.formaPagamento && !FORMAS.includes(d.formaPagamento)
        ? `<option selected>${esc(d.formaPagamento)}</option>`
        : "";
    const lines = (d.servicos || [])
      .map(
        (line) => `<tr data-ag-line="${esc(line.id)}">
          <td><input data-k="descricao" value="${esc(line.descricao || "")}" /></td>
          <td><input data-k="qtd" value="${esc(formatQty(line.qtd))}" inputmode="decimal" /></td>
          <td><input data-k="unit" value="${esc(centsToInput(line.unitCents))}" inputmode="decimal" /></td>
          <td class="ag-line-total" data-ag-total="${esc(line.id)}">${esc(money(lineTotalCents(line.qtd, line.unitCents)))}</td>
          <td><button type="button" class="secondary" data-ag-del="${esc(line.id)}">Excluir</button></td>
        </tr>`
      )
      .join("");
    return `<h3>Editar recibo</h3>
      <p class="ag-hint">Estes campos ajustam o documento. Placa, veículo, parceiro e serviços não alteram o cadastro. Valor, forma e data só entram no lançamento de Entradas se você marcar a opção no final e confirmar.</p>
      <label>Pagador</label><input data-ag-field="pagadorNome" value="${esc(d.pagadorNome)}" />
      <div class="ag-grid-2">
        <div><label>CPF/CNPJ</label><input data-ag-field="pagadorDoc" value="${esc(d.pagadorDoc)}" /></div>
        <div><label>Parceiro</label><input data-ag-field="parceiro" value="${esc(d.parceiro)}" /></div>
      </div>
      <div class="ag-grid-2">
        <div><label>Instituição financeira</label><input data-ag-field="instituicao" value="${esc(d.instituicao)}" /></div>
        <div><label>Escritório</label><input data-ag-field="escritorio" value="${esc(d.escritorio)}" /></div>
      </div>
      <div class="ag-grid-2">
        <div><label>Placa no recibo</label><input data-ag-field="placa" value="${esc(d.placa)}" /></div>
        <div><label>Marca/Modelo</label><input data-ag-field="marcaModelo" value="${esc(d.marcaModelo)}" /></div>
      </div>
      <div class="ag-grid-2">
        <div><label>RPP</label><input data-ag-field="rpp" value="${esc(d.rpp)}" /></div>
        <div><label>Localizador</label><input data-ag-field="localizador" value="${esc(d.localizador)}" /></div>
      </div>
      <div class="ag-grid-2">
        <div><label>Entrada</label><input data-ag-field="entradaYmd" type="date" value="${esc(d.entradaYmd)}" /></div>
        <div><label>Hora entrada</label><input data-ag-field="entradaHora" type="time" value="${esc(d.entradaHora)}" /></div>
      </div>
      <div class="ag-grid-2">
        <div><label>Saída</label><input data-ag-field="saidaYmd" type="date" value="${esc(d.saidaYmd)}" /></div>
        <div><label>Hora saída</label><input data-ag-field="saidaHora" type="time" value="${esc(d.saidaHora)}" /></div>
      </div>
      <label>Local</label><input data-ag-field="local" value="${esc(d.local)}" />
      <label>Serviços</label>
      <table class="ag-svc">
        <thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th><th></th></tr></thead>
        <tbody>${lines}</tbody>
      </table>
      <button type="button" class="secondary" data-ag-add style="margin-top:8px">+ Adicionar serviço</button>
      <div class="ag-grid-2">
        <div><label>Descontos</label><input data-ag-money="descontoCents" value="${esc(centsToInput(d.descontoCents))}" inputmode="decimal" /></div>
        <div><label>Acréscimos</label><input data-ag-money="acrescimoCents" value="${esc(centsToInput(d.acrescimoCents))}" inputmode="decimal" /></div>
      </div>
      <label>Forma de pagamento</label>
      <select data-ag-field="formaPagamento">${extraForma}${formaOpts}</select>
      <div class="ag-grid-2">
        <div><label>Data do pagamento</label><input data-ag-field="pagamentoYmd" type="date" value="${esc(d.pagamentoYmd)}" /></div>
        <div><label>Hora</label><input data-ag-field="pagamentoHora" type="time" value="${esc(d.pagamentoHora)}" /></div>
      </div>
      <label>Observações</label>
      <textarea data-ag-field="observacoes" rows="2">${esc(d.observacoes)}</textarea>
      <label>Responsável pelo recebimento</label>
      <input data-ag-field="responsavel" value="${esc(d.responsavel)}" />
      <label class="ag-check-row">
        <input type="checkbox" data-ag-flag="atualizarOficial" ${d.atualizarOficial ? "checked" : ""} />
        <span>Atualizar também o lançamento de Entradas com o valor total, a forma e a data do pagamento. O cadastro do veículo e o caixa não são alterados.</span>
      </label>
      <button type="button" class="secondary" data-ag-reload style="margin-top:10px">Recarregar do cadastro</button>`;
  }

  function render() {
    const sheet = document.getElementById("agReciboSheet");
    const editor = document.getElementById("agReciboEditor");
    if (sheet) sheet.innerHTML = sheetHtml();
    if (editor) {
      const editing = editor.dataset.open === "1";
      editor.classList.toggle("hidden", !editing);
      if (editing) editor.innerHTML = editorHtml();
    }
    const title = document.getElementById("agReciboBarTitle");
    if (title) {
      title.textContent = draft?.pago ? "Recibo de pagamento" : "Prévia do recibo — pagamento não confirmado";
    }
  }

  function pullEditor() {
    const root = document.getElementById("agReciboEditor");
    if (!root || root.dataset.open !== "1" || !draft) return;
    root.querySelectorAll("[data-ag-field]").forEach((el) => {
      draft[el.getAttribute("data-ag-field")] = el.value;
    });
    root.querySelectorAll("[data-ag-money]").forEach((el) => {
      draft[el.getAttribute("data-ag-money")] = parseMoney(el.value);
    });
    const flag = root.querySelector("[data-ag-flag='atualizarOficial']");
    draft.atualizarOficial = !!flag?.checked;
    const next = [];
    root.querySelectorAll("[data-ag-line]").forEach((tr) => {
      const id = tr.getAttribute("data-ag-line");
      const prev = (draft.servicos || []).find((s) => s.id === id) || { id };
      next.push({
        id,
        descricao: tr.querySelector("[data-k='descricao']")?.value || "",
        qtd: parseQty(tr.querySelector("[data-k='qtd']")?.value),
        unitCents: parseMoney(tr.querySelector("[data-k='unit']")?.value),
      });
      void prev;
    });
    draft.servicos = next;
  }

  function refreshLineTotals() {
    const root = document.getElementById("agReciboEditor");
    if (!root) return;
    (draft.servicos || []).forEach((line) => {
      const cell = root.querySelector(`[data-ag-total="${CSS.escape(line.id)}"]`);
      if (cell) cell.textContent = money(lineTotalCents(line.qtd, line.unitCents));
    });
  }

  function ensureModal() {
    if (document.getElementById("agReciboModal")) return;
    const el = document.createElement("div");
    el.id = "agReciboModal";
    el.className = "ag-modal hidden";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "agReciboBarTitle");
    el.innerHTML = `<div class="ag-modal-bar ag-no-print">
        <strong id="agReciboBarTitle">Recibo de pagamento</strong>
        <button type="button" class="secondary" id="agReciboEdit">Editar recibo</button>
        <button type="button" id="agReciboSave">Salvar</button>
        <button type="button" id="agReciboPrint">Imprimir recibo</button>
        <button type="button" class="secondary" id="agReciboPdf">Gerar PDF</button>
        <button type="button" class="secondary" id="agReciboClose">Fechar</button>
      </div>
      <div class="ag-modal-body">
        <aside id="agReciboEditor" class="ag-editor hidden" data-open="0"></aside>
        <div class="ag-stage"><div id="agReciboSheet"></div></div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#agReciboClose").addEventListener("click", close);
    el.querySelector("#agReciboEdit").addEventListener("click", () => {
      const editor = document.getElementById("agReciboEditor");
      const open = editor.dataset.open !== "1";
      if (!open) pullEditor();
      editor.dataset.open = open ? "1" : "0";
      editor.classList.toggle("hidden", !open);
      el.querySelector("#agReciboEdit").textContent = open ? "Concluir edição" : "Editar recibo";
      render();
    });
    el.querySelector("#agReciboSave").addEventListener("click", () => persist({ issueIfPaid: true, silent: false }));
    el.querySelector("#agReciboPrint").addEventListener("click", () => printReceipt());
    el.querySelector("#agReciboPdf").addEventListener("click", () => downloadPdf());
    el.addEventListener("click", onEditorClick);
    el.addEventListener("input", onEditorInput);
    el.addEventListener("change", onEditorInput);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.classList.contains("hidden")) close();
    });
  }

  function onEditorInput(e) {
    if (!e.target.closest("#agReciboEditor")) return;
    pullEditor();
    const sheet = document.getElementById("agReciboSheet");
    if (sheet) sheet.innerHTML = sheetHtml();
    refreshLineTotals();
  }

  function onEditorClick(e) {
    const add = e.target.closest("[data-ag-add]");
    const del = e.target.closest("[data-ag-del]");
    const reload = e.target.closest("[data-ag-reload]");
    if (!add && !del && !reload) return;
    pullEditor();
    if (add) {
      draft.servicos.push({ id: newLineId(), descricao: "", qtd: 1, unitCents: 0 });
    }
    if (del) {
      if ((draft.servicos || []).length <= 1) {
        alert("O recibo precisa de ao menos um serviço.");
        return;
      }
      const id = del.getAttribute("data-ag-del");
      draft.servicos = draft.servicos.filter((s) => s.id !== id);
    }
    if (reload) {
      const ok = confirm(
        "Substituir os campos do recibo pelos dados atuais do lançamento? O cadastro do veículo e o financeiro não serão alterados."
      );
      if (!ok) return;
      const fresh = buildDraft(findReceivable(draft.receivableId));
      fresh.token = draft.token;
      fresh.numero = draft.numero;
      fresh.receiptId = draft.receiptId;
      fresh.statusDoc = draft.statusDoc;
      draft = fresh;
    }
    render();
  }

  function close() {
    document.getElementById("agReciboModal")?.classList.add("hidden");
  }

  function missingTable(error) {
    return /schema cache|does not exist|relation|payment_receipts|could not find/i.test(
      `${error?.message || ""} ${error?.details || ""} ${error?.code || ""}`
    );
  }

  function tableMissingAlert() {
    alert(
      "A tabela de recibos ainda não existe neste banco. Execute o arquivo supabase/payment_receipts.sql no SQL Editor do Supabase. Esse script não altera Entradas, caixa nem veículos. Sem ele, o número oficial e a validação do QR Code não são gravados."
    );
  }

  async function loadExisting(receivableId) {
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!db() || !uid) return null;
    const { data, error } = await db()
      .from("payment_receipts")
      .select("*")
      .eq("user_id", uid)
      .eq("receivable_id", receivableId)
      .maybeSingle();
    if (error) {
      if (missingTable(error)) return { missing: true };
      console.warn("payment_receipts", error);
      return null;
    }
    return data;
  }

  async function loadQrLib() {
    if (window.QRCode?.CorrectLevel) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/vendor/qrcode.min.js?v=20261005recibo1";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("qrcode"));
      document.head.appendChild(s);
    });
  }

  async function renderQr() {
    qrDataUrl = "";
    if (!draft?.token) return;
    try {
      await loadQrLib();
      const holder = document.createElement("div");
      holder.setAttribute("aria-hidden", "true");
      holder.style.cssText = "position:fixed;left:-9999px;top:0;width:280px;height:280px;";
      document.body.appendChild(holder);
      new window.QRCode(holder, {
        text: validationUrl(draft.token),
        width: 280,
        height: 280,
        colorDark: "#0c3b2e",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      const canvas = holder.querySelector("canvas");
      if (canvas) qrDataUrl = canvas.toDataURL("image/png");
      holder.remove();
    } catch (e) {
      console.warn("qr recibo", e);
    }
  }

  function paymentIso(d) {
    if (!d.pagamentoYmd) return null;
    const hora = d.pagamentoHora && /^\d{2}:\d{2}$/.test(d.pagamentoHora) ? d.pagamentoHora : "00:00";
    const dt = new Date(`${d.pagamentoYmd}T${hora}:00`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  }

  function snapshotOf(d, numero, status) {
    const t = totals(d);
    return {
      pagadorNome: d.pagadorNome,
      pagadorDoc: d.pagadorDoc,
      parceiro: d.parceiro,
      instituicao: d.instituicao,
      escritorio: d.escritorio,
      placa: d.placa,
      marcaModelo: d.marcaModelo,
      rpp: d.rpp,
      localizador: d.localizador,
      entradaYmd: d.entradaYmd,
      entradaHora: d.entradaHora,
      saidaYmd: d.saidaYmd,
      saidaHora: d.saidaHora,
      diarias: d.diarias,
      local: d.local,
      servicos: d.servicos,
      descontoCents: d.descontoCents,
      acrescimoCents: d.acrescimoCents,
      formaPagamento: d.formaPagamento,
      pagamentoYmd: d.pagamentoYmd,
      pagamentoHora: d.pagamentoHora,
      observacoes: d.observacoes,
      responsavel: d.responsavel,
      numero,
      statusDoc: status,
      totalCents: t.total,
    };
  }

  async function updateReceivableOfficial(receivable) {
    if (typeof financeMetaPack !== "function" || typeof financeMetaUnpack !== "function") {
      alert("Não foi possível atualizar o lançamento: metadados financeiros indisponíveis.");
      return false;
    }
    const raw = typeof financeReceivableMetaText === "function" ? financeReceivableMetaText(receivable) : receivable.observacoes || "";
    const unpacked = financeMetaUnpack(raw);
    const meta = { ...(unpacked.meta || {}) };
    if (draft.pagamentoYmd) meta.data_pagamento = draft.pagamentoYmd;
    if (draft.formaPagamento) meta.forma_pagamento = draft.formaPagamento;
    const packed = financeMetaPack(meta, unpacked.text || "");
    const patch = {
      valor: Number(fromCents(totals(draft).total).toFixed(2)),
      forma_pagamento: draft.formaPagamento || null,
    };
    const obs = String(receivable.observacoes || "");
    const resp = String(receivable.responsavel_pagamento || "");
    if (resp.includes("[[finmeta:") && !obs.includes("[[finmeta:")) patch.responsavel_pagamento = packed;
    else patch.observacoes = packed;
    const uid = effectiveUserId();
    const { error } = await db().from("receivables").update(patch).eq("id", receivable.id).eq("user_id", uid);
    if (error) {
      alert(`Não foi possível atualizar o lançamento de Entradas.\n${error.message || ""}`);
      return false;
    }
    if (typeof loadReceivables === "function") await loadReceivables();
    if (typeof window.renderFinance === "function") window.renderFinance();
    return true;
  }

  async function persist(opts = {}) {
    if (!draft) return false;
    pullEditor();
    const receivable = findReceivable(draft.receivableId);
    if (!receivable) {
      alert("Lançamento de Entradas não encontrado.");
      return false;
    }
    draft.pago = isPaid(receivable);
    if (!(draft.servicos || []).some((s) => String(s.descricao || "").trim())) {
      alert("Informe a descrição de ao menos um serviço.");
      return false;
    }
    const uid = typeof effectiveUserId === "function" ? effectiveUserId() : null;
    if (!db() || !uid) {
      alert("Sessão indisponível para salvar o recibo.");
      return false;
    }
    if (!draft.token) draft.token = randomToken();

    if (draft.atualizarOficial) {
      const ok = confirm(
        "Confirmar atualização do lançamento de Entradas?\n\nSerão gravados o valor total, a forma de pagamento e a data do pagamento neste título.\nO cadastro do veículo e o movimento de caixa permanecem como estão."
      );
      if (!ok) return false;
      const updated = await updateReceivableOfficial(receivable);
      if (!updated) return false;
      draft.atualizarOficial = false;
    }

    let numero = draft.numero || existing?.numero || "";
    let status = existing?.status === "PAGO" ? "PAGO" : "PREVIA";
    if (opts.issueIfPaid && draft.pago && status !== "PAGO") {
      if (opts.confirmIssue && !confirm("O pagamento está confirmado. Emitir o recibo definitivo com número oficial?")) {
        return false;
      }
      const { data: n, error } = await db().rpc("next_payment_receipt_numero", { p_user: uid });
      if (error) {
        if (missingTable(error)) tableMissingAlert();
        else alert(`Não foi possível gerar o número do recibo.\n${error.message || ""}`);
        return false;
      }
      numero = String(n || "");
      status = "PAGO";
      if (!draft.responsavel) draft.responsavel = operatorName();
    }
    if (!draft.pago) status = "PREVIA";

    if (
      existing?.id &&
      existing.status === status &&
      stable(snapshotOf(draft, numero, status)) === stable(existing.snapshot || {})
    ) {
      draft.numero = existing.numero || numero;
      draft.statusDoc = existing.status;
      draft.receiptId = existing.id;
      return true;
    }

    if (existing?.status === "PAGO") {
      const changed = stable(snapshotOf(draft, numero, status)) !== stable(existing.snapshot || {});
      if (changed) {
        const ok = confirm(
          "Este recibo definitivo já foi emitido. A versão anterior será arquivada e esta alteração ficará registrada. O cadastro do veículo não será modificado. Continuar?"
        );
        if (!ok) return false;
        const rev = await db().from("payment_receipt_revisions").insert({
          receipt_id: existing.id,
          user_id: uid,
          numero: existing.numero,
          status: existing.status,
          snapshot: existing.snapshot || {},
          valor_total: existing.valor_total,
          alterado_por: operatorName(),
          motivo: "reemissao",
        });
        if (rev.error) {
          alert(`Não foi possível arquivar a versão anterior do recibo.\n${rev.error.message || ""}`);
          return false;
        }
      }
    }

    const row = {
      user_id: uid,
      receivable_id: receivable.id,
      vehicle_id: receivable.vehicle_id || null,
      numero: numero || null,
      status,
      token: draft.token,
      valor_total: Number(fromCents(totals(draft).total).toFixed(2)),
      forma_pagamento: draft.formaPagamento || null,
      placa_mascarada: maskPlate(draft.placa),
      snapshot: snapshotOf(draft, numero, status),
      confirmado_por: draft.responsavel || null,
      confirmado_user_id: appState()?.user?.id || null,
      pagamento_em: paymentIso(draft),
      emitido_em: status === "PAGO" ? existing?.emitido_em || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    let saved = null;
    let error = null;
    if (existing?.id) {
      const res = await db().from("payment_receipts").update(row).eq("id", existing.id).select("*").single();
      saved = res.data;
      error = res.error;
    } else {
      const res = await db().from("payment_receipts").insert(row).select("*").single();
      saved = res.data;
      error = res.error;
      if (error && String(error.code) === "23505") {
        const again = await loadExisting(receivable.id);
        if (again?.id) {
          existing = again;
          const res2 = await db().from("payment_receipts").update(row).eq("id", again.id).select("*").single();
          saved = res2.data;
          error = res2.error;
        }
      }
    }
    if (error) {
      if (missingTable(error)) tableMissingAlert();
      else alert(`Não foi possível salvar o recibo.\n${error.message || ""}`);
      return false;
    }
    existing = saved;
    draft.numero = saved?.numero || numero;
    draft.statusDoc = saved?.status || status;
    draft.receiptId = saved?.id || draft.receiptId;
    await renderQr();
    render();
    if (!opts.silent) alert(draft.statusDoc === "PAGO" ? `Recibo ${draft.numero} salvo.` : "Prévia do recibo salva. O documento definitivo sai quando o pagamento estiver confirmado.");
    return true;
  }

  function openPrintWindow() {
    const css = `${location.origin}/payment-receipt.css?v=20261005recibo2`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${esc(pdfName())}</title>
      <link rel="stylesheet" href="${css}" />
      <style>body{margin:0;background:#fff}.ag-sheet{box-shadow:none;width:auto;min-height:0}</style>
      </head><body>${sheetHtml()}</body></html>`;
    if (typeof printHtmlInHiddenIframe === "function") {
      printHtmlInHiddenIframe(html, { iframeTitle: "Recibo de pagamento" });
      return;
    }
    alert("Impressão indisponível neste navegador.");
  }

  async function printReceipt() {
    const needsIssue = !!(draft?.pago && !(draft.numero || existing?.numero));
    if (needsIssue && !confirm("O pagamento está confirmado. Emitir o recibo definitivo com número oficial antes de imprimir?")) {
      await renderQr();
      render();
      openPrintWindow();
      return;
    }
    const ok = await persist({ issueIfPaid: true, silent: true, confirmIssue: false });
    if (!ok && !confirm("Não foi possível registrar o recibo. Deseja imprimir só a pré-visualização?")) return;
    await renderQr();
    render();
    openPrintWindow();
  }

  function pdfName() {
    const placa = String(draft?.placa || "SEM-PLACA").replace(/[^a-z0-9]/gi, "") || "SEM-PLACA";
    const num = draft?.numero || "PREVIA";
    return `Recibo_AMPLIGUARD_${placa}_${num}.pdf`;
  }

  async function toDataUrl(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return "";
      const blob = await r.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = () => resolve("");
        fr.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  }

  async function downloadPdf() {
    const needsIssue = !!(draft?.pago && !(draft.numero || existing?.numero));
    if (needsIssue && !confirm("O pagamento está confirmado. Emitir o recibo definitivo com número oficial antes de gerar o PDF?")) {
      await renderQr();
      render();
    } else {
      const ok = await persist({ issueIfPaid: true, silent: true, confirmIssue: false });
      if (!ok && !confirm("Não foi possível registrar o recibo. Deseja gerar o PDF só da pré-visualização?")) return;
      await renderQr();
      render();
    }
    await renderQr();
    render();
    try {
      if (typeof loadJsPdf === "function") await loadJsPdf();
      const JsPDF = window.jspdf?.jsPDF;
      if (!JsPDF) throw new Error("jsPDF indisponível");
      const doc = new JsPDF({ unit: "pt", format: "a4" });
      await drawPdf(doc);
      doc.save(pdfName());
    } catch (e) {
      console.warn(e);
      alert("Não foi possível gerar o PDF.");
    }
  }

  async function drawPdf(doc) {
    const d = draft;
    const t = totals(d);
    const co = companyBits();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 32;
    const green = [12, 59, 46];
    const gold = [198, 161, 91];
    doc.setFillColor(...green);
    doc.rect(0, 0, pageW, 96, "F");
    const photo = await toDataUrl(PHOTO);
    if (photo) {
      try {
        doc.addImage(photo, "JPEG", pageW * 0.46, 0, pageW * 0.54, 96);
        doc.setFillColor(...green);
        doc.triangle(pageW * 0.42, 0, pageW * 0.62, 0, pageW * 0.42, 96, "F");
      } catch {
        /* foto opcional */
      }
    }
    const logo = await toDataUrl(LOGO);
    if (logo) {
      try {
        doc.addImage(logo, "PNG", margin, 16, 210, 42);
      } catch {
        /* logo opcional */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("MAIS QUE UM PÁTIO, UM COMPROMISSO.", margin, 74);
    doc.setFillColor(...green);
    doc.roundedRect(pageW - 168, 28, 140, 52, 6, 6, "F");
    doc.setDrawColor(...gold);
    doc.roundedRect(pageW - 168, 28, 140, 52, 6, 6, "S");
    doc.setFontSize(8);
    doc.text("RECIBO Nº", pageW - 98, 44, { align: "center" });
    doc.setFontSize(14);
    doc.text(d.numero || "——", pageW - 98, 62, { align: "center" });
    doc.setFillColor(...gold);
    doc.rect(0, 96, pageW, 3, "F");

    let y = 122;
    doc.setTextColor(18, 38, 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("RECIBO DE PAGAMENTO", margin, y);
    doc.setFontSize(9);
    doc.setTextColor(...(d.pago ? [21, 122, 69] : [138, 90, 18]));
    doc.text(d.pago ? "PAGO" : "PRÉVIA · AGUARDANDO PAGAMENTO", pageW - margin, y, { align: "right" });
    y += 22;
    doc.setTextColor(18, 38, 31);
    doc.setFontSize(8);
    doc.text("DADOS DO PAGADOR", margin, y);
    doc.text("DADOS DO VEÍCULO", pageW / 2 + 8, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const left = [
      d.pagadorNome || "—",
      `CPF/CNPJ: ${d.pagadorDoc || "—"}`,
      `Parceiro: ${d.parceiro || "—"}`,
      d.escritorio ? `Escritório: ${d.escritorio}` : "",
      d.instituicao ? `Instituição: ${d.instituicao}` : "",
    ].filter(Boolean);
    const right = [`Placa: ${d.placa || "—"}`, `Marca/Modelo: ${d.marcaModelo || "—"}`, `RPP / Localizador: ${[d.rpp, d.localizador].filter(Boolean).join(" / ") || "—"}`];
    const maxLines = Math.max(left.length, right.length);
    for (let i = 0; i < maxLines; i += 1) {
      if (left[i]) doc.text(left[i], margin, y);
      if (right[i]) doc.text(right[i], pageW / 2 + 8, y);
      y += 13;
    }
    y += 6;
    doc.setFontSize(9);
    doc.text(`Entrada: ${showDate(d.entradaYmd)} ${d.entradaHora || ""}`, margin, y);
    doc.text(`Saída: ${showDate(d.saidaYmd)} ${d.saidaHora || ""}`, margin + 170, y);
    y += 13;
    doc.text(`Período: ${periodoLabel(d)}`, margin, y);
    doc.text(`Local: ${d.local || co.local}`, margin + 170, y);
    y += 16;

    const cols = [margin, margin + 250, margin + 330, margin + 420];
    doc.setFillColor(...green);
    doc.rect(margin, y, pageW - margin * 2, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DESCRIÇÃO", cols[0] + 4, y + 11);
    doc.text("QTD.", cols[1], y + 11);
    doc.text("VALOR UNIT.", cols[2], y + 11);
    doc.text("TOTAL", cols[3], y + 11);
    y += 16;
    doc.setTextColor(18, 38, 31);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    (d.servicos || []).forEach((line, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(247, 245, 240);
        doc.rect(margin, y, pageW - margin * 2, 16, "F");
      }
      doc.setTextColor(18, 38, 31);
      doc.text(String(line.descricao || "—").slice(0, 48), cols[0] + 4, y + 11);
      doc.text(formatQty(line.qtd), cols[1], y + 11);
      doc.text(money(line.unitCents), cols[2], y + 11);
      doc.text(money(lineTotalCents(line.qtd, line.unitCents)), cols[3], y + 11);
      y += 16;
    });
    if (t.desc || t.acres) {
      y += 12;
      doc.setFontSize(8);
      doc.text(`${t.desc ? `Descontos: ${money(t.desc)}  ` : ""}${t.acres ? `Acréscimos: ${money(t.acres)}` : ""}`, margin, y);
    }
    y += 10;
    doc.setFillColor(...green);
    doc.roundedRect(margin, y, pageW - margin * 2, 28, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("TOTAL PAGO", margin + 10, y + 18);
    doc.setFontSize(16);
    doc.text(money(t.total), pageW - margin - 10, y + 19, { align: "right" });
    y += 46;
    doc.setTextColor(18, 38, 31);
    doc.setFontSize(8);
    doc.text("FORMA DE PAGAMENTO", margin, y);
    doc.text("PAGAMENTO REALIZADO EM", margin + 180, y);
    y += 12;
    doc.setFontSize(11);
    doc.text(d.formaPagamento || "—", margin, y);
    doc.text([showDate(d.pagamentoYmd), d.pagamentoHora].filter((x) => x && x !== "—").join(" - ") || "—", margin + 180, y);
    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, "PNG", pageW - margin - 78, y - 22, 72, 72);
      } catch {
        /* qr opcional */
      }
    }
    doc.setFontSize(7);
    doc.text("Documento autenticado via QR Code", pageW - margin - 78, y + 58);
    y += 36;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const decl = doc.splitTextToSize(
      "Declaramos, para os devidos fins, o recebimento do valor total acima discriminado, referente aos serviços indicados neste documento.",
      pageW - margin * 2 - 90
    );
    doc.text(decl, margin, y);
    y += decl.length * 12 + 28;
    doc.setDrawColor(30, 30, 30);
    doc.line(pageW / 2 - 90, y, pageW / 2 + 90, y);
    y += 12;
    doc.setFontSize(8);
    doc.text("Responsável pelo Recebimento", pageW / 2, y, { align: "center" });
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.text(d.responsavel || "AMPLIGUARD", pageW / 2, y, { align: "center" });
    const footY = 790;
    doc.setFillColor(...green);
    doc.rect(0, footY, pageW, 52, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(co.razao, margin, footY + 16);
    doc.setFont("helvetica", "normal");
    doc.text(`CNPJ: ${co.cnpj}  ·  ${co.site}`, margin, footY + 30);
    doc.text(`${co.tel}  ·  ${co.email}`, margin, footY + 42);
  }

  async function open(receivableId) {
    const receivable = findReceivable(receivableId);
    if (!receivable) {
      alert("Registro de Entradas não encontrado.");
      return;
    }
    ensureModal();
    const row = await loadExisting(receivable.id);
    if (row?.missing) {
      existing = null;
      draft = buildDraft(receivable);
    } else if (row?.id && row.snapshot) {
      existing = row;
      draft = applyRow(row, receivable);
    } else {
      existing = null;
      draft = buildDraft(receivable);
    }
    const editor = document.getElementById("agReciboEditor");
    if (editor) editor.dataset.open = "0";
    const editBtn = document.getElementById("agReciboEdit");
    if (editBtn) editBtn.textContent = "Editar recibo";
    await renderQr();
    render();
    document.getElementById("agReciboModal")?.classList.remove("hidden");
  }

  window.AmpliguardRecibo = { open };
})();
