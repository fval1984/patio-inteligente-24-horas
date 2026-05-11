import { Module } from "@nestjs/common";
import { EncryptionService } from "../../common/crypto/encryption.service";
import { BankProviderRegistry } from "./bank-provider.registry";
import { InterBankController } from "./inter-bank.controller";
import { InterBankProvider } from "./inter-bank.provider";
import { InterBankService } from "./inter-bank.service";
import { InterMtlsAgentFactory } from "./inter-mtls.agent";
import { InterOAuthService } from "./inter-oauth.service";

@Module({
  controllers: [InterBankController],
  providers: [
    InterMtlsAgentFactory,
    InterOAuthService,
    InterBankProvider,
    BankProviderRegistry,
    InterBankService,
    EncryptionService,
  ],
  exports: [
    BankProviderRegistry,
    InterBankProvider,
    InterOAuthService,
    InterMtlsAgentFactory,
    InterBankService,
    EncryptionService,
  ],
})
export class InterBankModule {}
