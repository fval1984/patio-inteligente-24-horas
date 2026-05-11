import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RegisterInterAccountDto } from "./dto/register-inter-account.dto";
import { InterBankService } from "./inter-bank.service";

type JwtReq = Request & { user: { sub: string } };

@ApiTags("inter-bank")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("inter-bank")
export class InterBankController {
  constructor(private readonly interBank: InterBankService) {}

  @Post("accounts")
  @ApiOperation({
    summary: "Registra conta PJ Inter (credenciais criptografadas em repouso).",
  })
  register(@Req() req: JwtReq, @Body() dto: RegisterInterAccountDto) {
    return this.interBank.registerInterAccount(req.user.sub, dto);
  }

  @Get("accounts/:id/balance")
  @ApiOperation({ summary: "Saldo na data (API Banking / saldo — requer escopo extrato.read)" })
  balance(
    @Req() req: JwtReq,
    @Param("id") id: string,
    @Query("dataSaldo") dataSaldo?: string
  ) {
    return this.interBank.getLiveBalance(id, req.user.sub, dataSaldo);
  }
}
