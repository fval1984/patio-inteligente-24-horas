import { useEffect, useMemo, useState } from "react";
import styles from "./caixa.module.css";

const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

type TipoMov = "ENTRADA" | "SAIDA" | "SANGRIA" | "REFORCO";
type CaixaResumo = {
  caixa: any;
  saldoAtual: number;
  entradasDia: number;
  saidasDia: number;
  entradasSemana: number;
  saidasSemana: number;
  entradasMes: number;
  saidasMes: number;
  sangriasMes?: number;
  lucroBruto: number;
  recentes: any[];
};

function currency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

const defaultFechamento = {
  total_dinheiro: "",
  total_pix: "",
  total_debito: "",
  total_credito: "",
  total_transferencia: "",
  observacoes: "",
};

export default function CaixaPage() {
  const [caixaId, setCaixaId] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [resumo, setResumo] = useState<CaixaResumo | null>(null);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [contasReceber, setContasReceber] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filtroHistorico, setFiltroHistorico] = useState({ from: "", to: "", status: "" });
  const [fechamento, setFechamento] = useState(defaultFechamento);

  const [novoLancamento, setNovoLancamento] = useState({
    tipo: "ENTRADA" as TipoMov,
    categoria: "SERVICO",
    descricao: "",
    valor: "",
    forma_pagamento: "PIX",
    referencia_veiculo_id: "",
    integrar_financeiro: true,
  });

  const [novaConta, setNovaConta] = useState({
    cliente: "",
    valor: "",
    data_vencimento: "",
    referencia_veiculo_id: "",
    financeira_id: "",
  });

  const caixaAberto = resumo?.caixa?.status === "ABERTO";

  const fluxo = useMemo(() => {
    const m = new Map<string, { input: number; output: number }>();
    lancamentos.forEach((l) => {
      const d = String(l.data_hora || "").slice(0, 10);
      if (!d) return;
      const cur = m.get(d) || { input: 0, output: 0 };
      const tipo = String(l.tipo_movimentacao || l.tipo || "");
      if (tipo === "ENTRADA" || tipo === "REFORCO") cur.input += Number(l.valor || 0);
      else cur.output += Number(l.valor || 0);
      m.set(d, cur);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([date, v]) => ({ date, input: v.input, output: v.output, net: v.input - v.output }));
  }, [lancamentos]);
  const maxFluxo = useMemo(() => Math.max(1, ...fluxo.map((i) => Math.max(i.input, i.output, Math.abs(i.net)))), [fluxo]);

  async function carregarHistorico() {
    const qs = new URLSearchParams();
    if (filtroHistorico.from) qs.set("from", filtroHistorico.from);
    if (filtroHistorico.to) qs.set("to", filtroHistorico.to);
    if (filtroHistorico.status) qs.set("status", filtroHistorico.status);
    const url = `/api/caixa/historico?${qs.toString() || "limit=100"}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Falha ao carregar histórico.");
    setHistorico(json.data || []);
  }

  async function carregarTudo(caixaIdArg?: string) {
    const id = caixaIdArg || caixaId;
    setError("");
    setSuccess("");
    try {
      const calls = [fetch("/api/caixa/historico?limit=80"), fetch("/api/caixa/contas-receber?limit=200")];
      if (id) {
        calls.push(fetch(`/api/caixa/dashboard?caixa_id=${encodeURIComponent(id)}`));
        calls.push(fetch(`/api/caixa/lancamentos?caixa_id=${encodeURIComponent(id)}&limit=200`));
      }
      const responses = await Promise.all(calls);
      const jsons = await Promise.all(responses.map((r) => r.json()));

      const historicoRes = responses[0];
      const historicoJson = jsons[0];
      if (!historicoRes.ok) throw new Error(historicoJson?.error || "Falha ao carregar histórico.");
      setHistorico(historicoJson.data || []);

      const contasRes = responses[1];
      const contasJson = jsons[1];
      if (!contasRes.ok) throw new Error(contasJson?.error || "Falha ao carregar contas a receber.");
      setContasReceber(contasJson.data || []);

      if (id) {
        const dashboardRes = responses[2];
        const dashboardJson = jsons[2];
        const lancRes = responses[3];
        const lancJson = jsons[3];
        if (!dashboardRes.ok) throw new Error(dashboardJson?.error || "Falha ao carregar dashboard.");
        if (!lancRes.ok) throw new Error(lancJson?.error || "Falha ao carregar lançamentos.");
        setResumo(dashboardJson.data || null);
        setLancamentos(lancJson.data || []);
      } else {
        setResumo(null);
        setLancamentos([]);
      }
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar caixa.");
    }
  }

  async function abrirCaixa() {
    try {
      setError("");
      const res = await fetch("/api/caixa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: SINGLE_USER_ID, saldo_inicial: Number(saldoInicial || 0) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao abrir caixa.");
      const id = String(json?.data?.id || "");
      setCaixaId(id);
      setSuccess("Caixa aberto com sucesso.");
      await carregarTudo(id);
    } catch (e: any) {
      setError(e?.message || "Falha ao abrir caixa.");
    }
  }

  async function localizarCaixaAberto() {
    try {
      setError("");
      const res = await fetch(`/api/caixa?usuario_id=${encodeURIComponent(SINGLE_USER_ID)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao localizar caixa.");
      const id = String(json?.data?.id || "");
      setCaixaId(id);
      await carregarTudo(id || undefined);
    } catch (e: any) {
      setError(e?.message || "Falha ao localizar caixa.");
    }
  }

  useEffect(() => {
    void localizarCaixaAberto();
  }, []);

  async function criarLancamento(tipoRapido?: TipoMov) {
    if (!caixaId) {
      setError("Abra o caixa antes de lançar movimentações.");
      return;
    }
    const tipo = tipoRapido || novoLancamento.tipo;
    try {
      setError("");
      const payload = {
        caixa_id: caixaId,
        usuario_id: SINGLE_USER_ID,
        ...novoLancamento,
        tipo,
        valor: Number(novoLancamento.valor || 0),
        referencia_veiculo_id: novoLancamento.referencia_veiculo_id || null,
      };
      const res = await fetch("/api/caixa/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao criar lançamento.");
      setNovoLancamento((prev) => ({ ...prev, descricao: "", valor: "", referencia_veiculo_id: "" }));
      setSuccess(`Movimentação ${tipo} registrada.`);
      await carregarTudo();
    } catch (e: any) {
      setError(e?.message || "Falha ao criar lançamento.");
    }
  }

  async function estornar(lancamentoId: string) {
    try {
      setError("");
      const res = await fetch("/api/caixa/lancamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ESTORNAR", lancamento_id: lancamentoId, usuario_id: SINGLE_USER_ID }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao estornar.");
      setSuccess("Estorno registrado com sucesso.");
      await carregarTudo();
    } catch (e: any) {
      setError(e?.message || "Falha ao estornar lançamento.");
    }
  }

  async function criarContaReceber() {
    try {
      setError("");
      const res = await fetch("/api/caixa/contas-receber", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...novaConta,
          valor: Number(novaConta.valor || 0),
          referencia_veiculo_id: novaConta.referencia_veiculo_id || null,
          financeira_id: novaConta.financeira_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao criar conta a receber.");
      setNovaConta({ cliente: "", valor: "", data_vencimento: "", referencia_veiculo_id: "", financeira_id: "" });
      await carregarTudo();
    } catch (e: any) {
      setError(e?.message || "Falha ao criar conta.");
    }
  }

  async function receberConta(contaId: string) {
    try {
      setError("");
      const res = await fetch("/api/caixa/contas-receber", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conta_id: contaId, usuario_id: SINGLE_USER_ID, forma_pagamento: "PIX", caixa_id: caixaId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao marcar conta como paga.");
      await carregarTudo();
    } catch (e: any) {
      setError(e?.message || "Falha ao receber conta.");
    }
  }

  const totaisFechamento = useMemo(() => {
    const sum = (key: string) => lancamentos.reduce((acc, x) => acc + (String(x.tipo_movimentacao || x.tipo) === key ? Number(x.valor || 0) : 0), 0);
    const entradas = sum("ENTRADA") + sum("REFORCO");
    const saidas = sum("SAIDA");
    const sangrias = sum("SANGRIA");
    const saldoFinal = Number(resumo?.saldoAtual || 0);
    const fisicoInformado =
      Number(fechamento.total_dinheiro || 0) +
      Number(fechamento.total_pix || 0) +
      Number(fechamento.total_debito || 0) +
      Number(fechamento.total_credito || 0) +
      Number(fechamento.total_transferencia || 0);
    return { entradas, saidas, sangrias, saldoFinal, fisicoInformado, diferenca: fisicoInformado - saldoFinal };
  }, [lancamentos, resumo?.saldoAtual, fechamento]);

  async function fechar() {
    if (!caixaId) return;
    try {
      setError("");
      const res = await fetch("/api/caixa/fechamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caixa_id: caixaId,
          usuario_id: SINGLE_USER_ID,
          total_dinheiro: Number(fechamento.total_dinheiro || 0),
          total_pix: Number(fechamento.total_pix || 0),
          total_debito: Number(fechamento.total_debito || 0),
          total_credito: Number(fechamento.total_credito || 0),
          total_transferencia: Number(fechamento.total_transferencia || 0),
          observacoes: fechamento.observacoes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao fechar caixa.");
      setSuccess("Caixa fechado com sucesso.");
      setFechamento(defaultFechamento);
      await localizarCaixaAberto();
    } catch (e: any) {
      setError(e?.message || "Falha ao fechar caixa.");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <section className={styles.panel}>
          <div className={styles.head}>
            <div>
              <h1 className={styles.title}>Caixa</h1>
              <p className={styles.subtitle}>Frente de caixa diário com saldo em tempo real, estorno auditado e fechamento técnico.</p>
            </div>
            <div className={styles.toolbar}>
              <input className={styles.input} type="number" step="0.01" placeholder="Saldo inicial" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
              <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void abrirCaixa()}>Abrir caixa</button>
              <button className={styles.button} onClick={() => void localizarCaixaAberto()}>Atualizar</button>
            </div>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>{success}</p> : null}
          <p className={styles.subtitle}>
            Caixa atual: {caixaId || "nenhum aberto"} | Status: {resumo?.caixa?.status || "SEM CAIXA"}
          </p>
        </section>

        <section className={styles.cards}>
          <article className={styles.card}>
            <div className={styles.label}>Saldo atual</div>
            <div className={styles.value}>{currency(resumo?.saldoAtual || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.label}>Entradas do dia</div>
            <div className={`${styles.value} ${styles.in}`}>{currency(resumo?.entradasDia || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.label}>Saídas do dia</div>
            <div className={`${styles.value} ${styles.out}`}>{currency(resumo?.saidasDia || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.label}>Total do dia</div>
            <div className={styles.value}>{currency((resumo?.entradasDia || 0) - (resumo?.saidasDia || 0))}</div>
          </article>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Ações rápidas</h2>
          <div className={styles.toolbar}>
            <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!caixaAberto} onClick={() => void criarLancamento("ENTRADA")}>Nova Entrada</button>
            <button className={`${styles.button} ${styles.buttonDanger}`} disabled={!caixaAberto} onClick={() => void criarLancamento("SAIDA")}>Nova Saída</button>
            <button className={styles.button} disabled={!caixaAberto} onClick={() => void criarLancamento("SANGRIA")}>Sangria</button>
            <button className={styles.button} disabled={!caixaAberto} onClick={() => void criarLancamento("REFORCO")}>Reforço</button>
          </div>
          {!caixaAberto ? <p className={styles.subtitle}>Abra o caixa para lançar movimentações.</p> : null}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Novo lançamento</h2>
          <div className={styles.toolbar}>
            <select className={styles.select} value={novoLancamento.tipo} onChange={(e) => setNovoLancamento((s) => ({ ...s, tipo: e.target.value as TipoMov }))}>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
              <option value="SANGRIA">Sangria</option>
              <option value="REFORCO">Reforço</option>
            </select>
            <input className={styles.input} placeholder="Categoria" value={novoLancamento.categoria} onChange={(e) => setNovoLancamento((s) => ({ ...s, categoria: e.target.value }))} />
            <input className={styles.input} placeholder="Descrição" value={novoLancamento.descricao} onChange={(e) => setNovoLancamento((s) => ({ ...s, descricao: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Valor" value={novoLancamento.valor} onChange={(e) => setNovoLancamento((s) => ({ ...s, valor: e.target.value }))} />
            <select className={styles.select} value={novoLancamento.forma_pagamento} onChange={(e) => setNovoLancamento((s) => ({ ...s, forma_pagamento: e.target.value }))}>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
              <option value="TRANSFERENCIA">Transferência</option>
            </select>
            <label className={styles.checkWrap}>
              <input type="checkbox" checked={novoLancamento.integrar_financeiro} onChange={(e) => setNovoLancamento((s) => ({ ...s, integrar_financeiro: e.target.checked }))} />
              Integrar com financeiro geral
            </label>
            <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!caixaAberto} onClick={() => void criarLancamento()}>Lançar</button>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Fechamento de caixa</h2>
          <div className={styles.cards}>
            <article className={styles.card}><div className={styles.label}>Entradas</div><div className={`${styles.value} ${styles.in}`}>{currency(totaisFechamento.entradas)}</div></article>
            <article className={styles.card}><div className={styles.label}>Saídas</div><div className={`${styles.value} ${styles.out}`}>{currency(totaisFechamento.saidas)}</div></article>
            <article className={styles.card}><div className={styles.label}>Sangrias</div><div className={`${styles.value} ${styles.out}`}>{currency(totaisFechamento.sangrias)}</div></article>
            <article className={styles.card}><div className={styles.label}>Saldo final calculado</div><div className={styles.value}>{currency(totaisFechamento.saldoFinal)}</div></article>
          </div>
          <div className={styles.toolbar}>
            <input className={styles.input} type="number" step="0.01" placeholder="Físico dinheiro" value={fechamento.total_dinheiro} onChange={(e) => setFechamento((s) => ({ ...s, total_dinheiro: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Físico pix" value={fechamento.total_pix} onChange={(e) => setFechamento((s) => ({ ...s, total_pix: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Físico débito" value={fechamento.total_debito} onChange={(e) => setFechamento((s) => ({ ...s, total_debito: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Físico crédito" value={fechamento.total_credito} onChange={(e) => setFechamento((s) => ({ ...s, total_credito: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Físico transferência" value={fechamento.total_transferencia} onChange={(e) => setFechamento((s) => ({ ...s, total_transferencia: e.target.value }))} />
            <input className={styles.input} placeholder="Observações" value={fechamento.observacoes} onChange={(e) => setFechamento((s) => ({ ...s, observacoes: e.target.value }))} />
            <button className={`${styles.button} ${styles.buttonDanger}`} disabled={!caixaAberto} onClick={() => void fechar()}>Fechar caixa</button>
          </div>
          <p className={styles.subtitle}>Diferença (quebra/sobra): {currency(totaisFechamento.diferenca)}</p>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Últimas movimentações</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Forma</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => {
                  const tipo = String(l.tipo_movimentacao || l.tipo || "");
                  return (
                    <tr key={l.id}>
                      <td>{String(l.data_hora || "").replace("T", " ").slice(0, 16)}</td>
                      <td className={tipo === "ENTRADA" || tipo === "REFORCO" ? styles.in : styles.out}>{tipo}</td>
                      <td>{l.descricao}</td>
                      <td>{l.forma_pagamento}</td>
                      <td>{currency(l.valor)}</td>
                      <td>{!l.is_estorno && caixaAberto ? <button className={styles.button} onClick={() => void estornar(l.id)}>Estornar</button> : "—"}</td>
                    </tr>
                  );
                })}
                {!lancamentos.length ? (
                  <tr><td colSpan={6}>Sem lançamentos no caixa.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Histórico de caixas</h2>
          <div className={styles.toolbar}>
            <input className={styles.input} type="date" value={filtroHistorico.from} onChange={(e) => setFiltroHistorico((s) => ({ ...s, from: e.target.value }))} />
            <input className={styles.input} type="date" value={filtroHistorico.to} onChange={(e) => setFiltroHistorico((s) => ({ ...s, to: e.target.value }))} />
            <select className={styles.select} value={filtroHistorico.status} onChange={(e) => setFiltroHistorico((s) => ({ ...s, status: e.target.value }))}>
              <option value="">Todos status</option>
              <option value="ABERTO">Abertos</option>
              <option value="FECHADO">Fechados</option>
            </select>
            <button className={styles.button} onClick={() => void carregarHistorico()}>Filtrar</button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Abertura</th>
                  <th>Fechamento</th>
                  <th>Status</th>
                  <th>Saldo inicial</th>
                  <th>Saldo final</th>
                  <th>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((c) => {
                  const fechamentoInfo = Array.isArray(c.caixa_fechamentos) ? c.caixa_fechamentos[0] : c.caixa_fechamentos;
                  return (
                    <tr key={c.id}>
                      <td>{String(c.data_abertura || "").replace("T", " ").slice(0, 16)}</td>
                      <td>{c.data_fechamento ? String(c.data_fechamento).replace("T", " ").slice(0, 16) : "—"}</td>
                      <td>{c.status}</td>
                      <td>{currency(c.saldo_inicial)}</td>
                      <td>{currency(c.saldo_final)}</td>
                      <td>{currency(Number(fechamentoInfo?.diferenca || 0))}</td>
                    </tr>
                  );
                })}
                {!historico.length ? (
                  <tr><td colSpan={6}>Sem histórico de caixas.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Fluxo diário</h2>
          <div className={styles.chart}>
            {fluxo.map((f) => (
              <div key={f.date} className={styles.barRow}>
                <div>{f.date.slice(8, 10)}/{f.date.slice(5, 7)}</div>
                <div className={styles.track}>
                  <div className={styles.barIn} style={{ width: `${(f.input / maxFluxo) * 100}%` }} />
                  <div className={styles.barOut} style={{ width: `${(f.output / maxFluxo) * 100}%` }} />
                </div>
                <div>{currency(f.net)}</div>
              </div>
            ))}
            {!fluxo.length ? <p className={styles.subtitle}>Sem dados de fluxo.</p> : null}
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Contas a receber</h2>
          <div className={styles.toolbar}>
            <input className={styles.input} placeholder="Cliente" value={novaConta.cliente} onChange={(e) => setNovaConta((s) => ({ ...s, cliente: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Valor" value={novaConta.valor} onChange={(e) => setNovaConta((s) => ({ ...s, valor: e.target.value }))} />
            <input className={styles.input} type="date" value={novaConta.data_vencimento} onChange={(e) => setNovaConta((s) => ({ ...s, data_vencimento: e.target.value }))} />
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void criarContaReceber()}>Salvar conta</button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {contasReceber.map((c) => (
                  <tr key={c.id}>
                    <td>{c.cliente}</td>
                    <td>{c.data_vencimento}</td>
                    <td><span className={`${styles.chip} ${c.status === "PAGO" ? styles.chipDone : styles.chipPending}`}>{c.status}</span></td>
                    <td>{currency(c.valor)}</td>
                    <td>{c.status !== "PAGO" && caixaAberto ? <button className={styles.button} onClick={() => void receberConta(c.id)}>Receber</button> : "—"}</td>
                  </tr>
                ))}
                {!contasReceber.length ? (
                  <tr><td colSpan={5}>Sem contas a receber.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

