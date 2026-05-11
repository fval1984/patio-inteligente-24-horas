import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "crypto";
import type { Request } from "express";

type ReqWithRaw = Request & { rawBody?: Buffer };

@Injectable()
export class InterWebhookSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get("webhooks.skipSignatureVerify") === true) return true;

    const secret = this.config.get<string>("webhooks.interPixHmacSecret");
    if (!secret) {
      throw new UnauthorizedException(
        "INTER_WEBHOOK_HMAC_SECRET não configurado (ou habilite INTER_WEBHOOK_SKIP_VERIFY=true só em dev)."
      );
    }
    const req = context.switchToHttp().getRequest<ReqWithRaw>();
    const raw = req.rawBody;
    if (!raw || !raw.length) {
      throw new UnauthorizedException("Corpo bruto ausente — ative rawBody no NestFactory.");
    }
    const headerName =
      this.config.get<string>("webhooks.interPixSignatureHeader") || "x-inter-signature";
    const sig = req.headers[headerName.toLowerCase()] ?? req.headers[headerName];
    const presented = Array.isArray(sig) ? sig[0] : sig;
    if (!presented) {
      throw new UnauthorizedException(`Cabeçalho de assinatura ausente (${headerName}).`);
    }
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(String(presented), "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Assinatura webhook inválida.");
    }
    return true;
  }
}
