import * as fs from "fs";
import * as https from "https";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InterMtlsAgentFactory {
  constructor(private readonly config: ConfigService) {}

  /**
   * Agent HTTPS com mTLS para chamadas à API oficial do Inter.
   * Prioridade: PFX (INTER_MTLS_PFX_PATH) ou par CERT+KEY.
   */
  build(): https.Agent {
    const pfxPath = this.config.get<string>("inter.mtlsPfxPath");
    const passphrase = this.config.get<string>("inter.mtlsPassphrase") || "";
    if (pfxPath && fs.existsSync(pfxPath)) {
      return new https.Agent({
        pfx: fs.readFileSync(pfxPath),
        passphrase,
        rejectUnauthorized: true,
      });
    }
    const certPath = this.config.get<string>("inter.mtlsCertPath");
    const keyPath = this.config.get<string>("inter.mtlsKeyPath");
    if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      return new https.Agent({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        passphrase: passphrase || undefined,
        rejectUnauthorized: true,
      });
    }
    throw new Error(
      "Certificado mTLS não configurado. Defina INTER_MTLS_PFX_PATH ou INTER_MTLS_CERT_PATH + INTER_MTLS_KEY_PATH."
    );
  }
}
