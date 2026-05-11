import { Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { InterWebhookSignatureGuard } from "./guards/inter-webhook-signature.guard";
import { InterPixWebhookService } from "./inter-pix-webhook.service";

type ReqWithRaw = Request & { rawBody?: Buffer };

@ApiTags("webhooks")
@Controller("webhooks")
@SkipThrottle()
export class InterPixWebhookController {
  constructor(private readonly pix: InterPixWebhookService) {}

  @Post("inter/pix")
  @ApiOperation({
    summary:
      "Callback PIX (Cob/CobV recebido). HMAC-SHA256(hex) do corpo bruto vs INTER_WEBHOOK_HMAC_SECRET. Opcional: cabeçalho x-tenant-id.",
  })
  @UseGuards(InterWebhookSignatureGuard)
  async interPix(@Req() req: ReqWithRaw) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const tenantHeader = headers["x-tenant-id"];
    const tenant =
      typeof tenantHeader === "string" ? tenantHeader : tenantHeader?.[0];
    return this.pix.handle(headers, raw, req.body, { tenantHeader: tenant });
  }
}
