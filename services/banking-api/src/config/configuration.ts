export default () => ({
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  jwt: {
    secret: process.env.JWT_SECRET || "dev-only-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },
  credentials: {
    masterKeyHex: process.env.CREDENTIALS_MASTER_KEY_HEX || "",
  },
  inter: {
    oauthBaseUrl:
      process.env.INTER_OAUTH_BASE_URL || "https://cdpj.partners.bancointer.com.br",
    apiBaseUrl:
      process.env.INTER_API_BASE_URL || "https://cdpj.partners.bancointer.com.br",
    tokenPath: process.env.INTER_TOKEN_PATH || "/oauth/v2/token",
    extratoCompletoPath:
      process.env.INTER_EXTRATO_COMPLETO_PATH || "/banking/v2/extrato/completo",
    extratoPath: process.env.INTER_EXTRATO_PATH || "/banking/v2/extrato",
    saldoPath: process.env.INTER_SALDO_PATH || "/banking/v2/saldo",
    mtlsCertPath: process.env.INTER_MTLS_CERT_PATH || "",
    mtlsKeyPath: process.env.INTER_MTLS_KEY_PATH || "",
    mtlsPfxPath: process.env.INTER_MTLS_PFX_PATH || "",
    mtlsPassphrase: process.env.INTER_MTLS_PASSPHRASE || "",
    defaultScopes:
      process.env.INTER_DEFAULT_SCOPES ||
      "extrato.read cob.read webhook.read webhook.write",
  },
  webhooks: {
    interPixHmacSecret: process.env.INTER_WEBHOOK_HMAC_SECRET || "",
    interPixSignatureHeader:
      process.env.INTER_WEBHOOK_SIGNATURE_HEADER || "x-inter-signature",
    skipSignatureVerify: process.env.INTER_WEBHOOK_SKIP_VERIFY === "true",
    defaultTenantId: process.env.WEBHOOK_DEFAULT_TENANT_ID || "",
  },
  statementSync: {
    cron: process.env.STATEMENT_SYNC_CRON || "0 6 * * *",
    maxDaysPerRequest: Number(process.env.INTER_EXTRATO_MAX_DAYS || 90),
  },
});
