import { Injectable } from "@nestjs/common";
import type { BankProvider } from "@prisma/client";
import type { BankProviderPort } from "../../core/banking/bank-provider.port";
import { InterBankProvider } from "./inter-bank.provider";

@Injectable()
export class BankProviderRegistry {
  constructor(private readonly inter: InterBankProvider) {}

  resolve(provider: BankProvider): BankProviderPort {
    switch (provider) {
      case "INTER":
        return this.inter;
      case "NUBANK":
      case "ITAU":
      case "OPEN_FINANCE":
        throw new Error(`Provedor ${provider} ainda não implementado — interface BankProviderPort pronta.`);
      default:
        throw new Error("Provedor desconhecido.");
    }
  }
}
