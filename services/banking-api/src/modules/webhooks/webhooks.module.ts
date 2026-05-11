import { Module } from "@nestjs/common";
import { InterPixWebhookController } from "./inter-pix-webhook.controller";
import { InterPixWebhookService } from "./inter-pix-webhook.service";
import { InterWebhookSignatureGuard } from "./guards/inter-webhook-signature.guard";
import { ReconciliationModule } from "../reconciliation/reconciliation.module";

@Module({
  imports: [ReconciliationModule],
  controllers: [InterPixWebhookController],
  providers: [InterPixWebhookService, InterWebhookSignatureGuard],
})
export class WebhooksModule {}
