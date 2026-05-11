import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReconciliationService } from "./reconciliation.service";

type JwtReq = Request & { user: { sub: string } };

@ApiTags("reconciliation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reconciliation")
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Get("pending")
  @ApiOperation({ summary: "Conciliações pendentes de revisão humana" })
  pending(@Req() req: JwtReq) {
    return this.reconciliation.listPending(req.user.sub);
  }

  @Post(":id/confirm")
  @ApiOperation({ summary: "Confirma manualmente uma conciliação pendente e dá baixa" })
  confirm(@Req() req: JwtReq, @Param("id") id: string) {
    return this.reconciliation.confirm(id, req.user.sub);
  }
}
