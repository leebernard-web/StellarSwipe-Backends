import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, IsObject, Min, Max } from 'class-validator';
import { InstanceType } from '../interfaces/instance-spec.interface';

export class ProvisionInstanceDto {
  @IsString()
  userId!: string;

  @IsString()
  instanceName!: string;

  @IsEnum(InstanceType)
  type!: InstanceType;

  @IsNumber()
  @Min(1)
  @Max(64)
  cpu!: number;

  @IsNumber()
  @Min(1)
  @Max(256)
  memory!: number;

  @IsNumber()
  @Min(10)
  @Max(10000)
  storage!: number;

  @IsNumber()
  @Min(100)
  @Max(100000)
  bandwidth!: number;

  @IsNumber()
  @Min(10)
  @Max(100000)
  maxConnections!: number;

  @IsBoolean()
  @IsOptional()
  dedicatedIp?: boolean;

  @IsString()
  @IsOptional()
  isolationLevel?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  replicaCount?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
