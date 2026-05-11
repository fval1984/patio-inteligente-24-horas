import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtService } from "@nestjs/jwt";
import { IsString, MinLength } from "class-validator";

class DevTokenDto {
  @IsString()
  @MinLength(1)
  tenantId!: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly jwt: JwtService) {}

  @Post("dev/token")
  @ApiOperation({
    summary:
      "Emite JWT de teste (sub = tenantId). Requer DEV_JWT_ENDPOINT=true — nunca habilite em produção.",
  })
  @ApiBody({ type: DevTokenDto })
  issueDev(@Body() body: DevTokenDto) {
    if (process.env.DEV_JWT_ENDPOINT !== "true") {
      throw new NotFoundException();
    }
    return {
      access_token: this.jwt.sign({ sub: body.tenantId }),
      token_type: "Bearer",
    };
  }
}
