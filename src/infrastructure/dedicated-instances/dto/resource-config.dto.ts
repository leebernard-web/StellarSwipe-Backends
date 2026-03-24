import { IsString, IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ResourceType } from '../entities/resource-allocation.entity';

export class ResourceConfigDto {
  @IsString()
  instanceId!: string;

  @IsEnum(ResourceType)
  resourceType!: ResourceType;

  @IsNumber()
  @Min(0)
  allocatedAmount!: number;

  @IsString()
  unit!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  limitAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  thresholdPercent?: number;
}

export class ResourceUsageDto {
  resourceType!: ResourceType;
  allocatedAmount!: number;
  usedAmount!: number;
  unit!: string;
  utilizationPercent!: number;
  limitAmount?: number;
  thresholdExceeded!: boolean;
}

export class InstanceResourcesDto {
  instanceId!: string;
  instanceName!: string;
  resources!: ResourceUsageDto[];
  overallUtilization!: number;
  alerts!: Array<{
    resourceType: ResourceType;
    message: string;
    severity: 'warning' | 'critical';
  }>;
}
