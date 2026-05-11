import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BankProvider, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../../common/crypto/encryption.service";
import { RegisterInterAccountDto } from "./dto/register-inter-account.dto";
import { BankProviderRegistry } from "./bank-provider.registry";

@Injectable()
export class InterBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly registry: BankProviderRegistry
  ) {}

  async registerInterAccount(tenantId: string, dto: RegisterInterAccountDto) {
    const enc = this.encryption.encryptJson({
      clientId: dto.clientId,
      clientSecret: dto.clientSecret,
    });
    const account = await this.prisma.bankAccount.create({
      data: {
        tenantId,
        provider: BankProvider.INTER,
        label: dto.label,
        agency: dto.agency,
        accountNumber: dto.accountNumber,
        externalAccountKey: dto.externalAccountKey,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        credential: {
          create: {
            encryptedBlob: enc.blob,
            iv: enc.iv,
            authTag: enc.authTag,
            oauthScopes: dto.oauthScopes,
          },
        },
      },
      include: { credential: true },
    });
    return {
      id: account.id,
      tenantId: account.tenantId,
      provider: account.provider,
      label: account.label,
      createdAt: account.createdAt,
    };
  }

  async getLiveBalance(bankAccountId: string, tenantId: string, dataSaldo?: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId, deletedAt: null },
    });
    if (!account) throw new NotFoundException("Conta não encontrada.");
    const secrets = await this.getDecryptedSecrets(bankAccountId, tenantId);
    const credRow = await this.prisma.bankCredential.findUnique({
      where: { bankAccountId },
    });
    const provider = this.registry.resolve(account.provider);
    const token = await provider.obtainToken({
      clientId: secrets.clientId,
      clientSecret: secrets.clientSecret,
      scopes: credRow?.oauthScopes || undefined,
    });
    if (!provider.fetchBalance) {
      throw new BadRequestException("Consulta de saldo não disponível para este provedor.");
    }
    const ymd = dataSaldo ?? new Date().toISOString().slice(0, 10);
    return provider.fetchBalance(token.accessToken, ymd);
  }

  async getDecryptedSecrets(bankAccountId: string, tenantId: string) {
    const acc = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, tenantId, deletedAt: null },
      include: { credential: true },
    });
    if (!acc?.credential) throw new NotFoundException("Conta bancária ou credencial não encontrada.");
    return this.encryption.decryptJson<{ clientId: string; clientSecret: string }>(
      acc.credential.encryptedBlob,
      acc.credential.iv,
      acc.credential.authTag
    );
  }
}
