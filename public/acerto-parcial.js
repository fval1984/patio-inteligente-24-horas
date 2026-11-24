/**
 * Acerto parcial de estadia.
 * Separa um período já vencido de diárias em um recebível em aberto.
 * Não quita o valor e não altera a data de entrada do veículo.
 */
(function acertoParcialModule(global) {
  "use strict";

  const ORIGEM = "Acerto parcial de estadia";

  function round(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100) / 100;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function ymdLocal(date) {
    const dt = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dt.getTime())) return "";
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  function parseYmd(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }

  function endOfLocalDay(ymd) {
    const p = parseYmd(ymd);
    if (!p) return null;
    return new Date(new Date(p.y, p.m - 1, p.d + 1).getTime() - 1);
  }

  function startOfNextLocalDay(ymd) {
    const p = parseYmd(ymd);
    if (!p) return null;
    return new Date(p.y, p.m - 1, p.d + 1);
  }

  function addDaysYmd(ymd, days) {
    const p = parseYmd(ymd);
    if (!p) return "";
    const dt = new Date(p.y, p.m - 1, p.d + Number(days || 0));
    return ymdLocal(dt);
  }

  function diasEntre(start, end) {
    const a = start instanceof Date ? start : new Date(start);
    const b = end instanceof Date ? end : new Date(end);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
    return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86400000));
  }

  function money(n) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(round(n));
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function metaOf(receivable) {
    const unpack = typeof global.financeMetaUnpack === "function" ? global.financeMetaUnpack(receivable?.observacoes) : null;
    const meta = unpack?.meta || {};
    return meta.acerto_parcial === true ? meta : null;
  }

  function acertosDoVeiculo(vehicle, receivables) {
    const id = String(vehicle?.id || "");
    if (!id) return [];
    return (receivables || [])
      .filter((r) => String(r?.vehicle_id || "") === id && metaOf(r))
      .sort((a, b) => String(metaOf(a).data_limite || a.period_end || "").localeCompare(String(metaOf(b).data_limite || b.period_end || "")));
  }

  function recebidoDo(receivable, cash) {
    const valor = round(receivable?.valor);
    const st = String(receivable?.status || "").toUpperCase();
    if (st === "PAGO" || st === "RECEBIDO" || st === "QUITADO") return valor;
    const pago = (cash || [])
      .filter((m) => {
        const tipo = String(m?.tipo_conta || "").toUpperCase();
        return String(m?.conta_id || "") === String(receivable?.id || "") && (tipo === "RECEBER" || tipo === "ENTRADA" || tipo === "RECEBIMENTO");
      })
      .reduce((s, m) => s + Number(m.valor || 0), 0);
    return round(Math.min(valor, Math.max(0, pago)));
  }

  function cursorYmd(vehicle, acertos) {
    const limites = acertos.map((r) => String(metaOf(r).data_limite || "").slice(0, 10)).filter(Boolean).sort();
    if (limites.length) return addDaysYmd(limites[limites.length - 1], 1);
    return ymdLocal(vehicle?.data_entrada);
  }

  function resumo(vehicle, receivables, agora, cash) {
    const now = agora instanceof Date ? agora : new Date();
    const fim = vehicle?.data_saida ? new Date(vehicle.data_saida) : now;
    const entrada = vehicle?.data_entrada ? new Date(vehicle.data_entrada) : null;
    const diaria = round(vehicle?.valor_diaria);
    const diasTotal = entrada ? diasEntre(entrada, fim) : 0;
    const bruto = round(diasTotal * diaria);
    const lista = acertosDoVeiculo(vehicle, receivables);
    let descontos = 0;
    let acertado = 0;
    let recebido = 0;
    const itens = lista.map((r) => {
      const meta = metaOf(r);
      const original = round(meta.valor_original != null ? meta.valor_original : r.valor);
      const desconto = round(meta.desconto || 0);
      const valor = round(r.valor);
      const ja = recebidoDo(r, cash);
      descontos = round(descontos + desconto);
      acertado = round(acertado + valor);
      recebido = round(recebido + ja);
      return {
        id: r.id,
        responsavel: meta.responsavel_nome || r.cobranca_destinatario_nome || r.responsavel_pagamento || "—",
        inicio: String(meta.periodo_inicio || r.period_start || "").slice(0, 10),
        limite: String(meta.data_limite || r.period_end || "").slice(0, 10),
        diarias: Number(meta.diarias || 0),
        original,
        desconto,
        valor,
        vencimento: String(meta.vencimento || r.data_vencimento || "").slice(0, 10),
        status: String(r.status || "EM_ABERTO"),
        recebido: ja,
        aReceber: round(Math.max(0, valor - ja)),
        observacoes: meta.observacoes_texto || "",
        quando: meta.em || r.created_at || "",
        usuario: meta.usuario || "",
      };
    });
    const cursor = cursorYmd(vehicle, lista);
    const hoje = ymdLocal(fim);
    let diasAberto = 0;
    if (cursor && hoje && cursor <= hoje && entrada) {
      const inicioAberto = cursor === ymdLocal(entrada) ? entrada : startOfNextLocalDay(addDaysYmd(cursor, -1));
      diasAberto = diasEntre(inicioAberto, fim);
    }
    const saldoAberto = round(diasAberto * diaria);
    const responsavelAtual =
      String(vehicle?.responsavel_financeiro_nome || "").trim() ||
      (typeof global.vehicleRpfNome === "function" ? global.vehicleRpfNome(vehicle) : "") ||
      "—";
    return {
      diasTotal,
      valorDiaria: diaria,
      bruto,
      descontos,
      acertado,
      recebido,
      aReceber: round(Math.max(0, acertado - recebido)),
      saldoAberto,
      diasAberto,
      responsavelAtual,
      cursor,
      hoje,
      entrada: ymdLocal(entrada),
      itens,
    };
  }

  function periodoDe(vehicle, dataLimite, receivables) {
    const base = resumo(vehicle, receivables, endOfLocalDay(dataLimite) || new Date());
    const cursor = base.cursor;
    if (!cursor || !dataLimite || dataLimite < cursor) return null;
    const entradaYmd = ymdLocal(vehicle?.data_entrada);
    const inicio = cursor === entradaYmd ? new Date(vehicle.data_entrada) : startOfNextLocalDay(addDaysYmd(cursor, -1));
    const fim = endOfLocalDay(dataLimite);
    if (!inicio || !fim) return null;
    const diarias = diasEntre(inicio, fim);
    const original = round(diarias * base.valorDiaria);
    return { inicio, fim, diarias, original, cursor, entradaYmd };
  }

  function validar(vehicle, input, receivables) {
    if (!vehicle?.id) return { ok: false, erro: "Veículo não encontrado." };
    if (String(vehicle.status || "").toUpperCase() === "REMOVIDO") {
      return { ok: false, erro: "O veículo já foi removido. O saldo em aberto segue na cobrança da saída." };
    }
    if (!vehicle.data_entrada) return { ok: false, erro: "O veículo não tem data de entrada." };
    const diaria = round(vehicle.valor_diaria);
    if (!(diaria > 0)) return { ok: false, erro: "Informe o valor da diária no veículo antes do acerto." };
    const limite = String(input?.dataLimite || "").slice(0, 10);
    const periodo = periodoDe(vehicle, limite, receivables);
    if (!periodo) return { ok: false, erro: "A data limite precisa estar dentro do saldo de estadia ainda não acertado." };
    const hoje = ymdLocal(new Date());
    if (limite > hoje) return { ok: false, erro: "A data limite não pode ser futura." };
    const duplicado = acertosDoVeiculo(vehicle, receivables).some((r) => String(metaOf(r).data_limite || "").slice(0, 10) === limite);
    if (duplicado) return { ok: false, erro: "Este período já foi acertado." };
    const original = periodo.original;
    let desconto = round(input?.desconto);
    let valor = input?.valorAcertado == null || input.valorAcertado === "" ? round(original - desconto) : round(input.valorAcertado);
    if (input?.origemEdicao === "desconto") valor = round(original - desconto);
    else if (input?.origemEdicao === "valor") desconto = round(original - valor);
    else desconto = round(original - valor);
    if (desconto < 0 || valor < 0) return { ok: false, erro: "O valor acertado não pode ser negativo nem maior que o período." };
    if (valor - original > 0.009) return { ok: false, erro: "O valor acertado não pode ser maior que o valor do período." };
    if (Math.abs(valor + desconto - original) > 0.02) return { ok: false, erro: "O desconto e o valor acertado não fecham com o período." };
    const responsavel = String(input?.responsavelNome || "").trim();
    if (!responsavel) return { ok: false, erro: "Selecione o responsável pelo acerto." };
    const novo = String(input?.novoResponsavelNome || "").trim();
    if (!novo) return { ok: false, erro: "Selecione o novo responsável pelo saldo restante." };
    const vencimento = String(input?.vencimento || "").slice(0, 10);
    if (!parseYmd(vencimento)) return { ok: false, erro: "Informe a data de vencimento." };
    return {
      ok: true,
      periodo,
      original,
      desconto,
      valor,
      limite,
      vencimento,
      responsavel,
      novo,
    };
  }

  function fichaHtml(vehicle, receivables, cash) {
    const r = resumo(vehicle, receivables, vehicle?.data_saida ? new Date(vehicle.data_saida) : new Date(), cash);
    const linhas = r.itens
      .map(
        (item) => `<li>
          <strong>${esc(item.responsavel)}</strong>
          · ${esc(item.inicio)} a ${esc(item.limite)}
          · ${esc(String(item.diarias))} diária(s)
          · ${esc(money(item.valor))}
          ${item.desconto > 0 ? `· desconto ${esc(money(item.desconto))}` : ""}
          · venc. ${esc(item.vencimento || "—")}
          · ${esc(item.aReceber > 0 ? "A receber" : "Recebido")}
        </li>`
      )
      .join("");
    return `<section class="vif-finance">
      <h2>Acerto da estadia</h2>
      <dl class="vif-meta">
        <div><dt>Data original de entrada</dt><dd>${esc(r.entrada || "—")}</dd></div>
        <div><dt>Total de diárias acumuladas</dt><dd>${esc(String(r.diasTotal))}</dd></div>
        <div><dt>Valor da diária</dt><dd>${esc(money(r.valorDiaria))}</dd></div>
        <div><dt>Valor bruto total da estadia</dt><dd>${esc(money(r.bruto))}</dd></div>
        <div><dt>Total de descontos concedidos</dt><dd>${esc(money(r.descontos))}</dd></div>
        <div><dt>Total de acertos parciais</dt><dd>${esc(money(r.acertado))}</dd></div>
        <div><dt>Total efetivamente recebido</dt><dd>${esc(money(r.recebido))}</dd></div>
        <div><dt>Total acertado e ainda a receber</dt><dd>${esc(money(r.aReceber))}</dd></div>
        <div><dt>Saldo de estadia ainda não acertado</dt><dd>${esc(money(r.saldoAberto))}</dd></div>
        <div><dt>Responsável atual pelo saldo</dt><dd>${esc(r.responsavelAtual || "—")}</dd></div>
      </dl>
      <h2>Histórico dos acertos parciais</h2>
      ${linhas ? `<ul class="vif-timeline">${linhas}</ul>` : `<p class="vif-empty">Nenhum acerto parcial registrado.</p>`}
    </section>`;
  }

  function parceiros(state) {
    return (state?.partners || [])
      .filter((p) => p && p.id && p.ativo !== false && String(p.status || "").toUpperCase() !== "INATIVO")
      .map((p) => ({ id: String(p.id), nome: String(p.nome || "").trim() || "Sem nome", tel: p.whatsapp || p.telefone || "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function optionsHtml(list, selectedId) {
    const opts = list
      .map((p) => `<option value="${esc(p.id)}"${p.id === selectedId ? " selected" : ""}>${esc(p.nome)}</option>`)
      .join("");
    return `<option value="">Selecione</option>${opts}`;
  }

  function lerPessoa(root, prefix) {
    const modo = root.querySelector(`[data-ap-modo="${prefix}"].is-on`)?.getAttribute("data-mode") || "cadastrado";
    if (modo === "avulso") {
      return {
        avulso: true,
        id: "",
        nome: root.querySelector(`[data-ap-nome="${prefix}"]`)?.value?.trim() || "",
        tel: root.querySelector(`[data-ap-tel="${prefix}"]`)?.value?.trim() || "",
      };
    }
    const sel = root.querySelector(`[data-ap-sel="${prefix}"]`);
    const id = sel?.value || "";
    const nome = sel?.selectedOptions?.[0]?.textContent?.trim() || "";
    const tel = root.__apParceiros?.find((p) => p.id === id)?.tel || "";
    return { avulso: false, id, nome: id ? nome : "", tel };
  }

  function pessoaHtml(prefix, titulo, list, selectedId) {
    return `<fieldset class="ap-pessoa">
      <legend>${esc(titulo)}</legend>
      <div class="ap-toggle">
        <button type="button" class="secondary is-on" data-ap-modo="${prefix}" data-mode="cadastrado">Cadastrado</button>
        <button type="button" class="secondary" data-ap-modo="${prefix}" data-mode="avulso">Avulso</button>
      </div>
      <label class="ap-cadastrado">Parceiro
        <select data-ap-sel="${prefix}">${optionsHtml(list, selectedId)}</select>
      </label>
      <div class="ap-avulso hidden">
        <label>Nome<input data-ap-nome="${prefix}" type="text" maxlength="160" autocomplete="off" /></label>
        <label>Telefone<input data-ap-tel="${prefix}" type="tel" maxlength="16" autocomplete="off" /></label>
      </div>
    </fieldset>`;
  }

  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById("acertoParcialStyles")) return;
    const style = document.createElement("style");
    style.id = "acertoParcialStyles";
    style.textContent = `
      #acertoParcialModal .modal { width: min(760px, calc(100% - 24px)); max-height: min(92vh, 900px); overflow: auto; }
      #acertoParcialModal .ap-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
      #acertoParcialModal label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; min-width: 0; }
      #acertoParcialModal input, #acertoParcialModal select, #acertoParcialModal textarea { width: 100%; box-sizing: border-box; min-height: 36px; }
      #acertoParcialModal textarea { min-height: 72px; }
      #acertoParcialModal .ap-pessoa { border: 1px solid var(--border, #d7dbe2); border-radius: 8px; padding: 10px; min-width: 0; }
      #acertoParcialModal .ap-toggle { display: flex; gap: 8px; margin-bottom: 8px; }
      #acertoParcialModal .ap-toggle .is-on { font-weight: 700; }
      #acertoParcialModal .ap-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }
      #acertoParcialModal .ap-resumo { display: grid; gap: 6px; margin: 8px 0 0; }
      @media (max-width: 700px) {
        #acertoParcialModal .ap-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function formHtml(vehicle, snap, list) {
    const atualId = String(vehicle.responsavel_financeiro_id || "");
    const venc = addDaysYmd(snap.hoje, 15);
    return `<h3>Acerto parcial</h3>
      <p class="notice">${esc(vehicle.placa || "—")} · ${esc([vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—")}</p>
      <div class="ap-grid">
        <label>Data original de entrada<input value="${esc(snap.entrada || "—")}" readonly /></label>
        <label>Diárias acumuladas<input value="${esc(String(snap.diasTotal))}" readonly /></label>
        <label>Valor da diária<input value="${esc(money(snap.valorDiaria))}" readonly /></label>
        <label>Valor bruto acumulado<input value="${esc(money(snap.bruto))}" readonly /></label>
        <label>Saldo disponível para acerto<input id="apSaldoDisponivel" value="${esc(money(snap.saldoAberto))}" readonly /></label>
        <label>Data limite das diárias acertadas<input id="apLimite" type="date" min="${esc(snap.cursor || "")}" max="${esc(snap.hoje || "")}" value="${esc(snap.hoje || "")}" /></label>
        <label>Diárias deste acerto<input id="apDiarias" readonly /></label>
        <label>Valor calculado até a data<input id="apOriginal" readonly /></label>
        <label>Valor acertado<input id="apValor" type="number" min="0" step="0.01" /></label>
        <label>Desconto concedido<input id="apDesconto" type="number" min="0" step="0.01" value="0" /></label>
        <label>Vencimento<input id="apVencimento" type="date" value="${esc(venc)}" /></label>
      </div>
      <div class="ap-grid" style="margin-top:12px">
        ${pessoaHtml("acerto", "Responsável pelo acerto", list, atualId)}
        ${pessoaHtml("novo", "Novo responsável pelo saldo restante", list, "")}
      </div>
      <label style="margin-top:12px">Observações<textarea id="apObs" maxlength="500"></textarea></label>
      <p id="apErro" class="notice" hidden></p>
      <div class="ap-actions">
        <button type="button" class="secondary" data-ap-cancelar>Cancelar</button>
        <button type="button" data-ap-resumo>Ver resumo</button>
      </div>`;
  }

  function mostrarErro(root, texto) {
    const el = root.querySelector("#apErro");
    if (!el) return;
    el.hidden = !texto;
    el.textContent = texto || "";
  }

  function atualizarCalculo(root, vehicle, receivables) {
    const limite = root.querySelector("#apLimite")?.value || "";
    const periodo = periodoDe(vehicle, limite, receivables);
    const diarias = root.querySelector("#apDiarias");
    const original = root.querySelector("#apOriginal");
    const valor = root.querySelector("#apValor");
    const desconto = root.querySelector("#apDesconto");
    if (!periodo) {
      if (diarias) diarias.value = "";
      if (original) original.value = "";
      return;
    }
    if (diarias) diarias.value = String(periodo.diarias);
    if (original) original.value = money(periodo.original);
    if (valor && root.__apValorTocado !== true) valor.value = periodo.original.toFixed(2);
    if (desconto && valor && root.__apValorTocado === true) {
      desconto.value = round(periodo.original - Number(valor.value || 0)).toFixed(2);
    }
    if (valor) valor.max = String(periodo.original);
  }

  function lerInput(root) {
    const acerto = lerPessoa(root, "acerto");
    const novo = lerPessoa(root, "novo");
    return {
      dataLimite: root.querySelector("#apLimite")?.value || "",
      valorAcertado: root.querySelector("#apValor")?.value,
      desconto: root.querySelector("#apDesconto")?.value,
      origemEdicao: root.__apOrigem || "valor",
      vencimento: root.querySelector("#apVencimento")?.value || "",
      responsavelNome: acerto.nome,
      responsavelId: acerto.id,
      responsavelTel: acerto.tel,
      responsavelAvulso: acerto.avulso,
      novoResponsavelNome: novo.nome,
      novoResponsavelId: novo.id,
      novoResponsavelTel: novo.tel,
      novoAvulso: novo.avulso,
      observacoes: root.querySelector("#apObs")?.value?.trim() || "",
    };
  }

  async function inserir(supabase, payload) {
    let current = { ...payload };
    let last = null;
    for (let i = 0; i < 10; i += 1) {
      const res = await supabase.from("receivables").insert(current).select("*").single();
      if (!res.error) return res;
      last = res.error;
      const msg = res.error.message || "";
      const found = msg.match(/'([^']+)'/);
      if (!/column|schema cache|PGRST204/i.test(msg) || !found || !(found[1] in current)) break;
      delete current[found[1]];
    }
    return { data: null, error: last };
  }

  async function confirmar(vehicle, input, ctx) {
    const checado = validar(vehicle, input, ctx.state?.receivables || []);
    if (!checado.ok) return checado;
    const agora = new Date().toISOString();
    const pack = ctx.pack;
    const meta = {
      acerto_parcial: true,
      origem_modulo: "ACERTO_PARCIAL_ESTADIA",
      origem_texto: ORIGEM,
      responsavel_id: input.responsavelId || "",
      responsavel_nome: checado.responsavel,
      responsavel_avulso: !!input.responsavelAvulso,
      periodo_inicio: checado.periodo.cursor === ymdLocal(vehicle.data_entrada) ? ymdLocal(vehicle.data_entrada) : checado.periodo.cursor,
      data_limite: checado.limite,
      diarias: checado.periodo.diarias,
      valor_original: checado.original,
      desconto: checado.desconto,
      valor_acertado: checado.valor,
      vencimento: checado.vencimento,
      data_acerto: agora,
      em: agora,
      usuario: ctx.operador || "",
      observacoes_texto: input.observacoes || "",
      calculo_patio: {
        dias: checado.periodo.diarias,
        valorDiaria: round(vehicle.valor_diaria),
        diariasTotal: checado.original,
        taxaRemocao: 0,
        taxasAdicionais: 0,
        total: checado.valor,
      },
    };
    const obs = typeof pack === "function" ? pack(meta, `${ORIGEM} — ${vehicle.placa || ""}`.trim()) : ORIGEM;
    const payload = {
      user_id: ctx.userId,
      vehicle_id: vehicle.id,
      responsavel_pagamento: checado.responsavel,
      cobranca_destinatario_nome: checado.responsavel,
      cobranca_destinatario_contato: input.responsavelTel || (input.responsavelAvulso ? "Avulso" : "Cadastrado"),
      receivable_category: "GUARDA_PATIO",
      valor: checado.valor,
      status: "EM_ABERTO",
      period_start: checado.periodo.inicio.toISOString(),
      period_end: checado.periodo.fim.toISOString(),
      data_vencimento: checado.vencimento,
      financeiro_aprovado_contas_receber: true,
      patio_liberado_financeiro: true,
      contas_receber_em: agora,
      observacoes: obs,
    };
    const inserted = await inserir(ctx.supabase, payload);
    if (inserted.error) return { ok: false, erro: inserted.error.message || "Não foi possível lançar o acerto." };
    const proximo = startOfNextLocalDay(checado.limite);
    const saldoDias = proximo && proximo.getTime() <= Date.now() ? diasEntre(proximo, new Date()) : 0;
    const saldoValor = round(saldoDias * round(vehicle.valor_diaria));
    const aberto = (ctx.state?.receivables || []).find(
      (r) => String(r.vehicle_id) === String(vehicle.id) && String(r.status || "").toUpperCase() === "EM_ABERTO" && (r.period_end == null || r.period_end === "") && String(r.id) !== String(inserted.data?.id || "")
    );
    const ciclo = {
      responsavel_pagamento: checado.novo,
      valor: saldoValor,
      period_start: proximo ? proximo.toISOString() : null,
      period_end: null,
      status: "EM_ABERTO",
      financeiro_aprovado_contas_receber: false,
    };
    if (aberto?.id) {
      await ctx.supabase.from("receivables").update(ciclo).eq("id", aberto.id).eq("user_id", ctx.userId);
    } else {
      await inserir(ctx.supabase, {
        user_id: ctx.userId,
        vehicle_id: vehicle.id,
        receivable_category: "GUARDA_PATIO",
        financeiro_aprovado_contas_receber: false,
        ...ciclo,
      });
    }
    const vehiclePatch = input.novoAvulso
      ? { responsavel_financeiro_id: null, responsavel_financeiro_nome: checado.novo }
      : { responsavel_financeiro_id: input.novoResponsavelId || null, responsavel_financeiro_nome: checado.novo };
    await ctx.supabase.from("vehicles").update(vehiclePatch).eq("id", vehicle.id).eq("user_id", ctx.userId);
    try {
      await ctx.supabase.from("vehicle_events").insert({
        vehicle_id: vehicle.id,
        tipo: "RESPONSAVEL_TROCADO",
        responsavel: ctx.operador || checado.novo,
        descricao: `${ORIGEM}. ${checado.periodo.diarias} diária(s) até ${checado.limite} para ${checado.responsavel}, valor ${money(checado.valor)}. Saldo seguinte com ${checado.novo}.`,
      });
    } catch (_e) {
      /* o histórico financeiro permanece no recebível */
    }
    if (typeof ctx.reload === "function") await ctx.reload(vehicle.id);
    return { ok: true, id: inserted.data?.id || "" };
  }

  function open(vehicle, ctx) {
    if (typeof document === "undefined") return;
    ensureStyles();
    document.getElementById("acertoParcialModal")?.remove();
    const snap = resumo(vehicle, ctx.state?.receivables || [], new Date(), ctx.state?.cash || []);
    const list = parceiros(ctx.state);
    const backdrop = document.createElement("div");
    backdrop.id = "acertoParcialModal";
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="apTitulo"><div id="apCorpo"></div></div>`;
    document.body.appendChild(backdrop);
    const corpo = backdrop.querySelector("#apCorpo");
    corpo.innerHTML = formHtml(vehicle, snap, list);
    backdrop.__apParceiros = list;
    corpo.__apParceiros = list;
    const fechar = () => backdrop.remove();
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) fechar();
    });
    corpo.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-ap-cancelar]")) {
        fechar();
        return;
      }
      const modo = ev.target.closest("[data-ap-modo]");
      if (modo) {
        const prefix = modo.getAttribute("data-ap-modo");
        corpo.querySelectorAll(`[data-ap-modo="${prefix}"]`).forEach((btn) => btn.classList.toggle("is-on", btn === modo));
        const avulso = modo.getAttribute("data-mode") === "avulso";
        corpo.querySelectorAll(".ap-pessoa").forEach((box) => {
          if (!box.querySelector(`[data-ap-modo="${prefix}"]`)) return;
          box.querySelector(".ap-cadastrado")?.classList.toggle("hidden", avulso);
          box.querySelector(".ap-avulso")?.classList.toggle("hidden", !avulso);
        });
      }
    });
    corpo.querySelector("#apLimite")?.addEventListener("change", () => {
      corpo.__apValorTocado = false;
      atualizarCalculo(corpo, vehicle, ctx.state?.receivables || []);
    });
    corpo.querySelector("#apValor")?.addEventListener("input", () => {
      corpo.__apValorTocado = true;
      corpo.__apOrigem = "valor";
      const periodo = periodoDe(vehicle, corpo.querySelector("#apLimite")?.value || "", ctx.state?.receivables || []);
      const desc = corpo.querySelector("#apDesconto");
      if (periodo && desc) desc.value = round(periodo.original - Number(corpo.querySelector("#apValor").value || 0)).toFixed(2);
    });
    corpo.querySelector("#apDesconto")?.addEventListener("input", () => {
      corpo.__apOrigem = "desconto";
      const periodo = periodoDe(vehicle, corpo.querySelector("#apLimite")?.value || "", ctx.state?.receivables || []);
      const valor = corpo.querySelector("#apValor");
      if (periodo && valor) valor.value = round(periodo.original - Number(corpo.querySelector("#apDesconto").value || 0)).toFixed(2);
    });
    atualizarCalculo(corpo, vehicle, ctx.state?.receivables || []);
    corpo.querySelector("[data-ap-resumo]")?.addEventListener("click", () => {
      const input = lerInput(corpo);
      const checado = validar(vehicle, input, ctx.state?.receivables || []);
      if (!checado.ok) {
        mostrarErro(corpo, checado.erro);
        return;
      }
      const depois = startOfNextLocalDay(checado.limite);
      const diasRestantes = depois && depois.getTime() <= Date.now() ? diasEntre(depois, new Date()) : 0;
      corpo.innerHTML = `<h3 id="apTitulo">Resumo do acerto parcial</h3>
        <div class="ap-resumo">
          <p><strong>${esc(vehicle.placa || "—")}</strong> · ${esc([vehicle.marca, vehicle.modelo].filter(Boolean).join(" ") || "—")}</p>
          <p>Período acertado: ${esc(checado.periodo.cursor)} a ${esc(checado.limite)} · ${esc(String(checado.periodo.diarias))} diária(s)</p>
          <p>Responsável pelo acerto: ${esc(checado.responsavel)}</p>
          <p>Valor do período: ${esc(money(checado.original))}</p>
          <p>Desconto: ${esc(money(checado.desconto))}</p>
          <p>Valor lançado em Entradas: ${esc(money(checado.valor))}</p>
          <p>Vencimento: ${esc(checado.vencimento)}</p>
          <p>Novo responsável pelo saldo: ${esc(checado.novo)}</p>
          <p>Saldo que permanece em aberto: ${esc(money(round(diasRestantes * round(vehicle.valor_diaria))))}</p>
          <p class="notice">O valor acertado não entra no Caixa até ser marcado como recebido.</p>
        </div>
        <p id="apErro" class="notice" hidden></p>
        <div class="ap-actions">
          <button type="button" class="secondary" data-ap-voltar>Voltar</button>
          <button type="button" data-ap-confirmar>Confirmar acerto</button>
        </div>`;
      corpo.querySelector("[data-ap-voltar]")?.addEventListener("click", () => open(vehicle, ctx));
      corpo.querySelector("[data-ap-confirmar]")?.addEventListener("click", async () => {
        const btn = corpo.querySelector("[data-ap-confirmar]");
        if (btn) btn.disabled = true;
        const resultado = await confirmar(vehicle, input, ctx);
        if (!resultado.ok) {
          mostrarErro(corpo, resultado.erro);
          if (btn) btn.disabled = false;
          return;
        }
        fechar();
      });
    });
  }

  const api = {
    origem: ORIGEM,
    resumo,
    validar,
    periodoDe,
    metaOf,
    fichaHtml,
    open,
    diasEntre,
    ymdLocal,
    endOfLocalDay,
    startOfNextLocalDay,
  };
  global.acertoParcial = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
