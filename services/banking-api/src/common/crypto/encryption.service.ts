import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const hex = this.config.get<string>("credentials.masterKeyHex");
    if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
      this.key = Buffer.from(hex, "hex");
      return;
    }
    const nodeEnv = this.config.get<string>("nodeEnv");
    if (nodeEnv !== "production") {
      this.logger.warn(
        "CREDENTIALS_MASTER_KEY_HEX ausente ou inválido — usando chave derivada só para desenvolvimento (não use em produção)."
      );
      this.key = scryptSync("dev-insecure", "salt-banking-api", 32);
      return;
    }
    throw new Error("CREDENTIALS_MASTER_KEY_HEX (64 hex) é obrigatório em produção.");
  }

  encryptJson(payload: object): { blob: string; iv: string; authTag: string } {
    if (!this.key) throw new Error("Chave de criptografia não inicializada.");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const json = Buffer.from(JSON.stringify(payload), "utf8");
    const enc = Buffer.concat([cipher.update(json), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      blob: enc.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  }

  decryptJson<T>(blob: string, ivB64: string, authTagB64: string): T {
    if (!this.key) throw new Error("Chave de criptografia não inicializada.");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([
      decipher.update(Buffer.from(blob, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(dec.toString("utf8")) as T;
  }
}
