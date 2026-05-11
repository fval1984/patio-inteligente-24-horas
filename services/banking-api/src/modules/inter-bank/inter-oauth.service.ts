import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import type { AccessTokenBundle } from "../../core/banking/bank-provider.port";
import { CircuitBreaker } from "../../common/resilience/circuit-breaker";
import { withRetries } from "../../common/resilience/retry";
import { InterMtlsAgentFactory } from "./inter-mtls.agent";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

@Injectable()
export class InterOAuthService {
  private readonly logger = new Logger(InterOAuthService.name);
  private readonly breaker = new CircuitBreaker({
    failureThreshold: 4,
    resetTimeoutMs: 45_000,
  });
  private readonly cache = new Map<string, { bundle: AccessTokenBundle }>();

  constructor(
    private readonly config: ConfigService,
    private readonly mtls: InterMtlsAgentFactory
  ) {}

  async getClientCredentialsToken(input: {
    clientId: string;
    clientSecret: string;
    scopes?: string;
  }): Promise<AccessTokenBundle> {
    const scope =
      input.scopes?.trim() ||
      this.config.get<string>("inter.defaultScopes") ||
      "extrato.read";
    const cacheKey = `${input.clientId}:${scope}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.bundle.expiresAt.getTime() > Date.now() + 30_000) {
      return hit.bundle;
    }

    const oauthBase = this.config.get<string>("inter.oauthBaseUrl");
    const tokenPath = this.config.get<string>("inter.tokenPath");
    const url = `${oauthBase}${tokenPath}`;
    const httpsAgent = this.mtls.build();

    const body = new URLSearchParams();
    body.set("client_id", input.clientId);
    body.set("client_secret", input.clientSecret);
    body.set("grant_type", "client_credentials");
    body.set("scope", scope);

    const bundle = await this.breaker.exec(() =>
      withRetries(
        async () => {
          const { data } = await axios.post<TokenResponse>(url, body.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            httpsAgent,
            timeout: 30_000,
          });
          const expiresAt = new Date(Date.now() + (data.expires_in - 90) * 1000);
          const b: AccessTokenBundle = {
            accessToken: data.access_token,
            expiresAt,
            tokenType: data.token_type,
            scope: data.scope || scope,
          };
          this.cache.set(cacheKey, { bundle: b });
          return b;
        },
        { retries: 3, baseDelayMs: 400, maxDelayMs: 8_000 }
      )
    );

    this.logger.log(`Token OAuth Inter obtido (expira em ${bundle.expiresAt.toISOString()}).`);
    return bundle;
  }

  clearCacheForTests() {
    this.cache.clear();
  }
}
