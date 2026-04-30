import { useEffect, useMemo, useState } from "react";
import styles from "./financeiro-v2.module.css";

type DashboardData = {
  competencia: string;
  saldoTotal: number;
  entradasDia: number;
  saidasDia: number;
  entradasSemana: number;
  saidasSemana: number;
  entradasMes: number;
  saidasMes: number;
  receitaPrevista: number;
  receitaRealizada: number;
  despesasMes: number;
  lucroLiquido: number;
  totalReceber: number;
  totalEmAberto: number;
  ticketMedioPorVeiculo: number;
  recentes: Array<{
    id: string;
    data_movimento: string;
    descricao: string;
    tipo: "RECEITA" | "DESPESA";
    status: "PENDENTE" | "REALIZADO";
    valor: number;
  }>;
};

type Conta = {
  id: string;
  tipo: "RECEBER" | "PAGAR";
  descricao: string;
  vencimento: string;
  status: "PENDENTE" | "REALIZADO";
  valor: number;
};

type Transacao = {
  id: string;
  data_movimento: string;
  descricao: string;
  tipo: "RECEITA" | "DESPESA";
  status: "PENDENTE" | "REALIZADO";
  valor: number;
  categoria_id?: string | null;
  veiculo_id?: string | null;
};

type RelatorioData = {
  competencia: string;
  lucroMensal: number;
  entradas: number;
  saidas: number;
  custosPorVeiculo: Array<{ veiculo_id: string; valor: number }>;
};

function currency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

function currentCompetencia() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceiroV2Page() {
  const [competencia, setCompetencia] = useState(currentCompetencia());
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("");
  const [filtroFrom, setFiltroFrom] = useState("");
  const [filtroTo, setFiltroTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [novaTransacao, setNovaTransacao] = useState({
    tipo: "RECEITA",
    status: "REALIZADO",
    valor: "",
    descricao: "",
    data_movimento: "",
  });

  const [novaConta, setNovaConta] = useState({
    tipo: "RECEBER",
    status: "PENDENTE",
    valor: "",
    descricao: "",
    vencimento: "",
    recorrencia: "NAO",
  });

  async function carregarTudo() {
    setLoading(true);
    setError("");
    try {
      const tQuery = new URLSearchParams({
        competencia,
        limit: "300",
      });
      if (filtroTipo) tQuery.set("tipo", filtroTipo);
      if (filtroStatus) tQuery.set("status", filtroStatus);
      if (filtroCategoria.trim()) tQuery.set("categoria_id", filtroCategoria.trim());
      if (filtroVeiculo.trim()) tQuery.set("veiculo_id", filtroVeiculo.trim());
      if (filtroFrom) tQuery.set("from", filtroFrom);
      if (filtroTo) tQuery.set("to", filtroTo);
      if (busca.trim()) tQuery.set("busca", busca.trim());

      const [dRes, cRes, tRes, rRes] = await Promise.all([
        fetch(`/api/financeiro-v2/dashboard?competencia=${encodeURIComponent(competencia)}`),
        fetch(`/api/financeiro-v2/contas?competencia=${encodeURIComponent(competencia)}&limit=100`),
        fetch(`/api/financeiro-v2/transacoes?${tQuery.toString()}`),
        fetch(`/api/financeiro-v2/relatorios?competencia=${encodeURIComponent(competencia)}`),
      ]);
      const [dJson, cJson, tJson, rJson] = await Promise.all([dRes.json(), cRes.json(), tRes.json(), rRes.json()]);
      if (!dRes.ok) throw new Error(dJson?.error || "Falha ao carregar dashboard.");
      if (!cRes.ok) throw new Error(cJson?.error || "Falha ao carregar contas.");
      if (!tRes.ok) throw new Error(tJson?.error || "Falha ao carregar transações.");
      if (!rRes.ok) throw new Error(rJson?.error || "Falha ao carregar relatórios.");
      setDashboard(dJson.data || null);
      setContas(cJson.data || []);
      setTransacoes(tJson.data || []);
      setRelatorio(rJson.data || null);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar Financeiro v2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    void carregarTudo();
  }, [competencia, filtroTipo, filtroStatus, filtroCategoria, filtroVeiculo, filtroFrom, filtroTo, busca]);

  const contasAtrasadas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return contas.filter((c) => c.status === "PENDENTE" && c.vencimento < hoje);
  }, [contas]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(transacoes.length / pageSize)), [transacoes.length]);
  const transacoesPaginadas = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return transacoes.slice(start, start + pageSize);
  }, [transacoes, page, totalPages]);

  const fluxoPorDia = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    transacoes.forEach((t) => {
      const day = String(t.data_movimento || "").slice(0, 10);
      if (!day) return;
      const current = map.get(day) || { in: 0, out: 0 };
      if (t.tipo === "RECEITA") current.in += Number(t.valor || 0);
      else current.out += Number(t.valor || 0);
      map.set(day, current);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([date, values]) => ({ date, in: values.in, out: values.out, net: values.in - values.out }));
  }, [transacoes]);

  const maxFluxo = useMemo(() => {
    return Math.max(1, ...fluxoPorDia.map((i) => Math.max(Math.abs(i.in), Math.abs(i.out), Math.abs(i.net))));
  }, [fluxoPorDia]);

  async function salvarTransacao() {
    if (!novaTransacao.descricao.trim() || Number(novaTransacao.valor || 0) <= 0) return;
    const res = await fetch("/api/financeiro-v2/transacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...novaTransacao,
        valor: Number(novaTransacao.valor),
        data_movimento: novaTransacao.data_movimento || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Falha ao salvar transação.");
      return;
    }
    setNovaTransacao({ tipo: "RECEITA", status: "REALIZADO", valor: "", descricao: "", data_movimento: "" });
    await carregarTudo();
  }

  async function salvarConta() {
    if (!novaConta.descricao.trim() || Number(novaConta.valor || 0) <= 0 || !novaConta.vencimento) return;
    const res = await fetch("/api/financeiro-v2/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...novaConta, valor: Number(novaConta.valor) }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Falha ao salvar conta.");
      return;
    }
    setNovaConta({ tipo: "RECEBER", status: "PENDENTE", valor: "", descricao: "", vencimento: "", recorrencia: "NAO" });
    await carregarTudo();
  }

  async function marcarContaComoRealizada(id: string) {
    const res = await fetch("/api/financeiro-v2/contas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "REALIZADO" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Falha ao atualizar conta.");
      return;
    }
    await carregarTudo();
  }

  async function marcarTransacaoComoRealizada(id: string) {
    const res = await fetch("/api/financeiro-v2/transacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "REALIZADO" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error || "Falha ao atualizar transação.");
      return;
    }
    await carregarTudo();
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Financeiro v2</h1>
            <p className={styles.subtitle}>Internet banking empresarial para operação diária do pátio.</p>
          </div>
          <div className={styles.actions}>
            <input className={styles.input} type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void carregarTudo()} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </header>

        {error ? <p className={styles.alert}>{error}</p> : null}
        {contasAtrasadas.length ? <p className={styles.alert}>Atenção: {contasAtrasadas.length} conta(s) vencida(s).</p> : null}

        <section className={styles.gridCards}>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Saldo total</div>
            <div className={styles.cardValue}>{currency(dashboard?.saldoTotal || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Receita realizada (mês)</div>
            <div className={`${styles.cardValue} ${styles.in}`}>{currency(dashboard?.receitaRealizada || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Receita prevista (mês)</div>
            <div className={`${styles.cardValue} ${styles.in}`}>{currency(dashboard?.receitaPrevista || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Despesas (mês)</div>
            <div className={`${styles.cardValue} ${styles.out}`}>{currency(dashboard?.despesasMes || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Entradas dia/semana/mês</div>
            <div className={styles.cardValue}>
              {currency(dashboard?.entradasDia || 0)} / {currency(dashboard?.entradasSemana || 0)} / {currency(dashboard?.entradasMes || 0)}
            </div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Saídas dia/semana/mês</div>
            <div className={styles.cardValue}>
              {currency(dashboard?.saidasDia || 0)} / {currency(dashboard?.saidasSemana || 0)} / {currency(dashboard?.saidasMes || 0)}
            </div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Lucro líquido</div>
            <div className={styles.cardValue}>{currency(dashboard?.lucroLiquido || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.cardLabel}>Ticket médio por veículo</div>
            <div className={styles.cardValue}>{currency(dashboard?.ticketMedioPorVeiculo || 0)}</div>
          </article>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Fluxo de caixa (12 últimos dias da competência)</h2>
          <div className={styles.chartWrap}>
            {fluxoPorDia.map((item) => (
              <div key={item.date} className={styles.barRow}>
                <div className={styles.barLabel}>{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</div>
                <div className={styles.barTrack}>
                  <div className={styles.barIn} style={{ width: `${(Math.abs(item.in) / maxFluxo) * 100}%` }} />
                  <div className={styles.barOut} style={{ width: `${(Math.abs(item.out) / maxFluxo) * 100}%` }} />
                </div>
                <div className={styles.barValue}>{currency(item.net)}</div>
              </div>
            ))}
            {!fluxoPorDia.length ? <p className={styles.subtitle}>Sem dados para o gráfico no período.</p> : null}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Relatórios analíticos</h2>
          <div className={styles.gridCards}>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Lucro mensal</div>
              <div className={styles.cardValue}>{currency(relatorio?.lucroMensal || 0)}</div>
            </article>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Entradas realizadas</div>
              <div className={`${styles.cardValue} ${styles.in}`}>{currency(relatorio?.entradas || 0)}</div>
            </article>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Saídas realizadas</div>
              <div className={`${styles.cardValue} ${styles.out}`}>{currency(relatorio?.saidas || 0)}</div>
            </article>
            <article className={styles.card}>
              <div className={styles.cardLabel}>Competência</div>
              <div className={styles.cardValue}>{relatorio?.competencia || "-"}</div>
            </article>
          </div>
          <div className={styles.tableWrap} style={{ marginTop: 10 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Veículo</th>
                  <th>Custo total</th>
                </tr>
              </thead>
              <tbody>
                {(relatorio?.custosPorVeiculo || []).map((item) => (
                  <tr key={item.veiculo_id}>
                    <td>{item.veiculo_id}</td>
                    <td>{currency(item.valor)}</td>
                  </tr>
                ))}
                {!(relatorio?.custosPorVeiculo || []).length ? (
                  <tr>
                    <td colSpan={2}>Sem custos por veículo nesta competência.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Nova transação</h2>
          <div className={styles.toolbar}>
            <select className={styles.select} value={novaTransacao.tipo} onChange={(e) => setNovaTransacao((s) => ({ ...s, tipo: e.target.value }))}>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
            <select className={styles.select} value={novaTransacao.status} onChange={(e) => setNovaTransacao((s) => ({ ...s, status: e.target.value }))}>
              <option value="REALIZADO">Realizado</option>
              <option value="PENDENTE">Pendente</option>
            </select>
            <input className={styles.input} placeholder="Descrição" value={novaTransacao.descricao} onChange={(e) => setNovaTransacao((s) => ({ ...s, descricao: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Valor" value={novaTransacao.valor} onChange={(e) => setNovaTransacao((s) => ({ ...s, valor: e.target.value }))} />
            <input className={styles.input} type="date" value={novaTransacao.data_movimento} onChange={(e) => setNovaTransacao((s) => ({ ...s, data_movimento: e.target.value }))} />
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void salvarTransacao()}>
              Salvar transação
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contas a pagar / receber</h2>
          <div className={styles.toolbar}>
            <select className={styles.select} value={novaConta.tipo} onChange={(e) => setNovaConta((s) => ({ ...s, tipo: e.target.value }))}>
              <option value="RECEBER">Receber</option>
              <option value="PAGAR">Pagar</option>
            </select>
            <select className={styles.select} value={novaConta.status} onChange={(e) => setNovaConta((s) => ({ ...s, status: e.target.value }))}>
              <option value="PENDENTE">Pendente</option>
              <option value="REALIZADO">Realizado</option>
            </select>
            <input className={styles.input} placeholder="Descrição" value={novaConta.descricao} onChange={(e) => setNovaConta((s) => ({ ...s, descricao: e.target.value }))} />
            <input className={styles.input} type="number" step="0.01" placeholder="Valor" value={novaConta.valor} onChange={(e) => setNovaConta((s) => ({ ...s, valor: e.target.value }))} />
            <input className={styles.input} type="date" value={novaConta.vencimento} onChange={(e) => setNovaConta((s) => ({ ...s, vencimento: e.target.value }))} />
            <select className={styles.select} value={novaConta.recorrencia} onChange={(e) => setNovaConta((s) => ({ ...s, recorrencia: e.target.value }))}>
              <option value="NAO">Sem recorrência</option>
              <option value="MENSAL">Mensal</option>
              <option value="SEMANAL">Semanal</option>
            </select>
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void salvarConta()}>
              Salvar conta
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.tipo}</td>
                    <td>{c.descricao}</td>
                    <td>{c.vencimento}</td>
                    <td>
                      <span className={`${styles.chip} ${c.status === "REALIZADO" ? styles.chipDone : styles.chipPending}`}>{c.status}</span>
                    </td>
                    <td>{currency(c.valor)}</td>
                    <td>
                      {c.status !== "REALIZADO" ? (
                        <button className={styles.button} onClick={() => void marcarContaComoRealizada(c.id)}>
                          Marcar realizado
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!contas.length ? (
                  <tr>
                    <td colSpan={6}>Sem contas nesta competência.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Extrato financeiro</h2>
          <div className={styles.toolbar}>
            <input className={styles.input} placeholder="Buscar por descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            <select className={styles.select} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Tipo: todos</option>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </select>
            <select className={styles.select} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Status: todos</option>
              <option value="REALIZADO">Realizado</option>
              <option value="PENDENTE">Pendente</option>
            </select>
            <input
              className={styles.input}
              placeholder="Categoria ID"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            />
            <input className={styles.input} placeholder="Veículo ID" value={filtroVeiculo} onChange={(e) => setFiltroVeiculo(e.target.value)} />
            <input className={styles.input} type="date" value={filtroFrom} onChange={(e) => setFiltroFrom(e.target.value)} />
            <input className={styles.input} type="date" value={filtroTo} onChange={(e) => setFiltroTo(e.target.value)} />
            <button
              className={styles.button}
              onClick={() => {
                setBusca("");
                setFiltroTipo("");
                setFiltroStatus("");
                setFiltroCategoria("");
                setFiltroVeiculo("");
                setFiltroFrom("");
                setFiltroTo("");
              }}
            >
              Limpar filtros
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {transacoesPaginadas.map((t) => (
                  <tr key={t.id}>
                    <td>{t.data_movimento}</td>
                    <td>{t.descricao}</td>
                    <td className={t.tipo === "RECEITA" ? styles.in : styles.out}>{t.tipo}</td>
                    <td>
                      <span className={`${styles.chip} ${t.status === "REALIZADO" ? styles.chipDone : styles.chipPending}`}>{t.status}</span>
                    </td>
                    <td>{currency(t.valor)}</td>
                    <td>
                      {t.status !== "REALIZADO" ? (
                        <button className={styles.button} onClick={() => void marcarTransacaoComoRealizada(t.id)}>
                          Marcar realizado
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!transacoesPaginadas.length ? (
                  <tr>
                    <td colSpan={6}>Sem transações para o filtro atual.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={styles.pagination}>
            <span>Página {Math.min(page, totalPages)} de {totalPages} • {transacoes.length} registro(s)</span>
            <div className={styles.paginationActions}>
              <button className={styles.button} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </button>
              <button className={styles.button} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Próxima
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

