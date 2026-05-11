import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterInterAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  clientId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  clientSecret!: string;

  @ApiPropertyOptional({
    description: "Escopos OAuth separados por espaço (default do servidor se omitido).",
  })
  @IsOptional()
  @IsString()
  oauthScopes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalAccountKey?: string;

  @ApiPropertyOptional({ description: "Metadados (ex.: paths mTLS específicos da conta)." })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
