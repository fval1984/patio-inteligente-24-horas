import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateReceivableDto } from "./dto/create-receivable.dto";
import { FinancialService } from "./financial.service";

type JwtReq = Request & { user: { sub: string } };

@ApiTags("financial")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("financial")
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get("dashboard/summary")
  @ApiOperation({ summary: "Resumo financeiro (entradas/saídas do dia, pendências, fluxo mensal)" })
  summary(@Req() req: JwtReq, @Query("bankAccountId") bankAccountId?: string) {
    return this.financial.dashboard(req.user.sub, bankAccountId);
  }

  @Post("receivables")
  @ApiOperation({ summary: "Cria conta a receber interna" })
  createReceivable(@Req() req: JwtReq, @Body() dto: CreateReceivableDto) {
    return this.financial.createReceivable(req.user.sub, dto);
  }
}
