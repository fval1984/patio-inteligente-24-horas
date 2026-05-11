import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import type { BankProvider } from "@prisma/client";
import type {
  AccessTokenBundle,
  BankProviderPort,
  StatementQuery,
} from "../../core/banking/bank-provider.port";
import type { NormalizedBankTransaction } from "../../core/banking/normalized-transaction";
import { InterMtlsAgentFactory } from "./inter-mtls.agent";
import { InterOAuthService } from "./inter-oauth.service";
import { mapInterExtratoPayloadToNormalized } from "./inter-statement.mapper";

@Injectable()
export class InterBankProvider implements BankProviderPort {
  readonly provider: BankProvider = "INTER";
  private readonly logger = new Logger(InterBankProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mtls: InterMtlsAgentFactory,
    private readonly oauth: InterOAuthService
  ) {}

  async obtainToken(input: {
    clientId: string;
    clientSecret: string;
    scopes?: string;
  }): Promise<AccessTokenBundle> {
    return this.oauth.getClientCredentialsToken(input);
  }

  async fetchStatement(
    token: string,
    query: StatementQuery
  ): Promise<NormalizedBankTransaction[]> {
    const apiBase = this.config.get<string>("inter.apiBaseUrl");
    const path = this.config.get<string>("inter.extratoCompletoPath");
    const httpsAgent = this.mtls.build();
    const aggregated: NormalizedBankTransaction[] = [];
    let pagina = query.pagina ?? 0;
    const tamanho = query.tamanhoPagina ?? 100;
    for (let guard = 0; guard < 200; guard++) {
      const { data } = await axios.get<unknown>(`${apiBase}${path}`, {
        httpsAgent,
        headers: { Authorization: `Bearer ${token}` },
        params: {
          dataInicio: query.dataInicio,
          dataFim: query.dataFim,
          pagina,
          tamanhoPagina: tamanho,
        },
        timeout: 60_000,
      });
      const batch = mapInterExtratoPayloadToNormalized(data);
      if (batch.length === 0) break;
      aggregated.push(...batch);
      if (batch.length < tamanho) break;
      pagina += 1;
    }
    this.logger.log(
      `Extrato Inter: ${aggregated.length} lançamentos entre ${query.dataInicio} e ${query.dataFim}.`
    );
    return aggregated;
  }

  async fetchBalance(token: string, dataSaldo: string) {
    const apiBase = this.config.get<string>("inter.apiBaseUrl");
    const path = this.config.get<string>("inter.saldoPath");
    const httpsAgent = this.mtls.build();
    const { data } = await axios.get(`${apiBase}${path}`, {
      httpsAgent,
      headers: { Authorization: `Bearer ${token}` },
      params: { dataSaldo },
      timeout: 30_000,
    });
    const d = data as Record<string, unknown>;
    const amount =
      Number(d.disponivel ?? d.saldo ?? d.valor ?? d.amount ?? 0) || 0;
    return { amount, currency: String(d.moeda || "BRL") };
  }
}
