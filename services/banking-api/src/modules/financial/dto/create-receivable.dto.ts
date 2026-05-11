import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateReceivableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  totalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payerDocument?: string;

  @ApiPropertyOptional({ description: "txid da cobrança PIX vinculada (conciliação automática)." })
  @IsOptional()
  @IsString()
  linkedPixTxid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string;
}
