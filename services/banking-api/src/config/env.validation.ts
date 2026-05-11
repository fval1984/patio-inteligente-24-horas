import { plainToInstance } from "class-transformer";
import { IsOptional, IsString, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  CREDENTIALS_MASTER_KEY_HEX?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length) {
    const msg = errors.map((e) => JSON.stringify(e.constraints)).join("; ");
    throw new Error(`Configuração inválida: ${msg}`);
  }
  return validated;
}
