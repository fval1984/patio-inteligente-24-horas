import type { BankProvider } from "@prisma/client";
import type { NormalizedBankTransaction } from "./normalized-transaction";

export type StatementQuery = {
  dataInicio: string;
  dataFim: string;
  pagina?: number;
  tamanhoPagina?: number;
};

export type AccessTokenBundle = {
  accessToken: string;
  expiresAt: Date;
  tokenType: string;
  scope?: string;
};

export interface BankProviderPort {
  readonly provider: BankProvider;

  obtainToken(input: {
    clientId: string;
    clientSecret: string;
    scopes?: string;
  }): Promise<AccessTokenBundle>;

  fetchStatement(
    token: string,
    query: StatementQuery
  ): Promise<NormalizedBankTransaction[]>;

  fetchBalance?(token: string, dataSaldo: string): Promise<{ amount: number; currency: string }>;
}
