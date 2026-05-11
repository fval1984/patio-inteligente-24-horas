import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StatementSyncService, type SyncMode } from "./statement-sync.service";
import { ConfigService } from "@nestjs/config";

type JwtReq = Request & { user: { sub: string } };

@ApiTags("sync")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("sync")
export class SyncController {
  constructor(
    private readonly statementSync: StatementSyncService,
    private readonly config: ConfigService
  ) {}

  @Post("statements/:bankAccountId")
  @ApiOperation({ summary: "Sincronização manual de extrato (incremental, full ou manual)" })
  @ApiBody({
    schema: {
      properties: { mode: { type: "string", enum: ["FULL", "INCREMENTAL", "MANUAL"] } },
    },
  })
  async syncStatement(
    @Req() req: JwtReq,
    @Param("bankAccountId") bankAccountId: string,
    @Body() body: { mode?: SyncMode }
  ) {
    const maxDays = this.config.get<number>("statementSync.maxDaysPerRequest") ?? 90;
    return this.statementSync.syncBankAccount(
      bankAccountId,
      req.user.sub,
      body?.mode ?? "MANUAL",
      maxDays
    );
  }
}
