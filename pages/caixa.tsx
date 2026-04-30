import { useEffect, useMemo, useState } from "react";
import styles from "./caixa.module.css";

const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

type CaixaResumo = {
  caixa: any;
  saldoAtual: number;
  entradasDia: number;
  saidasDia: number;
  entradasSemana: number;
  saidasSemana: number;
  entradasMes: number;
  saidasMes: number;
  lucroBruto: number;
  recentes: any[];
};

function currency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));
}

export default function CaixaPage() {
  const [caixaId, setCaixaId] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [resumo, setResumo] = useState<CaixaResumo | null>(null);
  const [lancamentos, setLancamentos] = useState<any[]>([]);
  const [contasReceber, setContasReceber] = useState<any[]>([]);
  const [error, setError] = useState("");

  const [novoLancamento, setNovoLancamento] = useState({
    tipo: "ENTRADA",
    categoria: "SERVICO",
    descricao: "",
    valor: "",
    forma_pagamento: "PIX",
    referencia_veiculo_id: "",
  });

  const [novaConta, setNovaConta] = useState({
    cliente: "",
    valor: "",
    data_vencimento: "",
    referencia_veiculo_id: "",
    financeira_id: "",
  });

  const fluxo = useMemo(() => {
    const m = new Map<string, { in: number; out: number }>();
    lancamentos.forEach((l) => {
      const d = String(l.data_hora || "").slice(0, 10);
      if (!d) return;
      const cur = m.get(d) || { in: 0, out: 0 };
      if (l.tipo === "ENTRADA") cur.in += Number(l.valor || 0);
      else cur.out += Number(l.valor || 0);
      m.set(d, cur);
    });
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([date, v]) => ({ date, in: v.in, out: v.out, net: v.in - v.out }));
  }, [lancamentos]);
  const maxFluxo = useMemo(() => Math.max(1, ...fluxo.map((i) => Math.max(i.in, i.out, Math.abs(i.net)))), [fluxo]);

  async function carregarTudo(caixaIdArg?: string) {
    const id = caixaIdArg || caixaId;
    if (!id) return;
    setError("");
    try {
      const [dRes, lRes, cRes] = await Promise.all([
        fetch(`/api/caixa/dashboard?caixa_id=${encodeURIComponent(id)}`),
        fetch(`/api/caixa/lancamentos?caixa_id=${encodeURIComponent(id)}&limit=200`),
        fetch(`/api/caixa/contas-receber?limit=200`),
      ]);
      const [dJson, lJson, cJson] = await Promise.all([dRes.json(), lRes.json(), cRes.json()]);
      if (!dRes.ok) throw new Error(dJson?.error || "Falha ao carregar dashboard.");
      if (!lRes.ok) throw new Error(lJson?.error || "Falha ao carregar lançamentos.");
      if (!cRes.ok) throw new Error(cJson?.error || "Falha ao carregar contas a receber.");
      setResumo(dJson.data || null);
      setLancamentos(lJson.data || []);
      setContasReceber(cJson.data || []);
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
      if (!id) {
        setCaixaId("");
        return;
      }
      setCaixaId(id);
      await carregarTudo(id);
    } catch (e: any) {
      setError(e?.message || "Falha ao localizar caixa.");
    }
  }

  useEffect(() => {
    void localizarCaixaAberto();
  }, []);

  async function criarLancamento() {
    try {
      setError("");
      const res = await fetch("/api/caixa/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caixa_id: caixaId,
          usuario_id: SINGLE_USER_ID,
          ...novoLancamento,
          valor: Number(novoLancamento.valor || 0),
          referencia_veiculo_id: novoLancamento.referencia_veiculo_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao criar lançamento.");
      setNovoLancamento({
        tipo: "ENTRADA",
        categoria: "SERVICO",
        descricao: "",
        valor: "",
        forma_pagamento: "PIX",
        referencia_veiculo_id: "",
      });
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
        body: JSON.stringify({ action: "ESTORNAR", lancamento_id: lancamentoId, usuario_id: usuarioId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao estornar.");
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
        body: JSON.stringify({ conta_id: contaId, usuario_id: usuarioId, forma_pagamento: "PIX", caixa_id: caixaId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao marcar conta como paga.");
      await carregarTudo();
    } catch (e: any) {
      setError(e?.message || "Falha ao receber conta.");
    }
  }

  async function fechar() {
    try {
      setError("");
      const total = Number(resumo?.saldoAtual || 0);
      const res = await fetch("/api/caixa/fechamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caixa_id: caixaId,
          usuario_id: SINGLE_USER_ID,
          total_dinheiro: total,
          total_pix: 0,
          total_debito: 0,
          total_credito: 0,
          total_transferencia: 0,
          observacoes: "Fechamento rápido",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao fechar caixa.");
      await carregarTudo();
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
              <h1 className={styles.title}>Caixa Financeiro</h1>
              <p className={styles.subtitle}>Controle bancário diário com integração operacional.</p>
            </div>
            <div className={styles.toolbar}>
              <input className={styles.input} type="number" step="0.01" placeholder="Saldo inicial" value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} />
              <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void abrirCaixa()}>
                Abrir caixa
              </button>
              <button className={styles.button} onClick={() => void localizarCaixaAberto()}>
                Buscar caixa aberto
              </button>
            </div>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <p className={styles.subtitle}>Caixa atual: {caixaId || "—"}</p>
        </section>

        <section className={styles.cards}>
          <article className={styles.card}>
            <div className={styles.label}>Saldo atual</div>
            <div className={styles.value}>{currency(resumo?.saldoAtual || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.label}>Entradas dia / mês</div>
            <div className={`${styles.value} ${styles.in}`}>{currency(resumo?.entradasDia || 0)} / {currency(resumo?.entradasMes || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.label}>Saídas dia / mês</div>
            <div className={`${styles.value} ${styles.out}`}>{currency(resumo?.saidasDia || 0)} / {currency(resumo?.saidasMes || 0)}</div>
          </article>
          <article className={styles.card}>
            <div className={styles.label}>Lucro bruto</div>
            <div className={styles.value}>{currency(resumo?.lucroBruto || 0)}</div>
          </article>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Novo lançamento</h2>
          <div className={styles.toolbar}>
            <select className={styles.select} value={novoLancamento.tipo} onChange={(e) => setNovoLancamento((s) => ({ ...s, tipo: e.target.value }))}>
              <option value="ENTRADA">Entrada</option>
              <option value="SAIDA">Saída</option>
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
            <input className={styles.input} placeholder="Veículo ID (opcional)" value={novoLancamento.referencia_veiculo_id} onChange={(e) => setNovoLancamento((s) => ({ ...s, referencia_veiculo_id: e.target.value }))} />
            <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => void criarLancamento()}>Lançar</button>
            <button className={`${styles.button} ${styles.buttonDanger}`} onClick={() => void fechar()}>Fechar caixa</button>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Fluxo de caixa</h2>
          <div className={styles.chart}>
            {fluxo.map((f) => (
              <div key={f.date} className={styles.barRow}>
                <div>{f.date.slice(8, 10)}/{f.date.slice(5, 7)}</div>
                <div className={styles.track}>
                  <div className={styles.barIn} style={{ width: `${(f.in / maxFluxo) * 100}%` }} />
                  <div className={styles.barOut} style={{ width: `${(f.out / maxFluxo) * 100}%` }} />
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
            <input className={styles.input} placeholder="Veículo ID (opcional)" value={novaConta.referencia_veiculo_id} onChange={(e) => setNovaConta((s) => ({ ...s, referencia_veiculo_id: e.target.value }))} />
            <input className={styles.input} placeholder="Financeira ID (opcional)" value={novaConta.financeira_id} onChange={(e) => setNovaConta((s) => ({ ...s, financeira_id: e.target.value }))} />
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
                    <td>{c.status !== "PAGO" ? <button className={styles.button} onClick={() => void receberConta(c.id)}>Receber</button> : "—"}</td>
                  </tr>
                ))}
                {!contasReceber.length ? (
                  <tr><td colSpan={5}>Sem contas a receber.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.title} style={{ fontSize: 16 }}>Últimos lançamentos</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Tipo</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Forma</th>
                  <th>Valor</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td>{String(l.data_hora || "").replace("T", " ").slice(0, 16)}</td>
                    <td className={l.tipo === "ENTRADA" ? styles.in : styles.out}>{l.tipo}</td>
                    <td>{l.categoria}</td>
                    <td>{l.descricao}</td>
                    <td>{l.forma_pagamento}</td>
                    <td>{currency(l.valor)}</td>
                    <td><button className={styles.button} onClick={() => void estornar(l.id)}>Estornar</button></td>
                  </tr>
                ))}
                {!lancamentos.length ? (
                  <tr><td colSpan={7}>Sem lançamentos no caixa.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

