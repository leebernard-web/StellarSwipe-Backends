import { InstanceStatus } from '../interfaces/instance-spec.interface';
import { ResourceMetrics } from '../interfaces/instance-spec.interface';

export class InstanceStatusDto {
  id!: string;
  userId!: string;
  instanceName!: string;
  status!: InstanceStatus;
  ingressUrl?: string;
  dedicatedIp?: string;
  provisionedAt?: Date;
  metrics?: ResourceMetrics;
  health?: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  };
  uptime?: {
    seconds: number;
    percentage: number;
  };
  createdAt!: Date;
  updatedAt!: Date;
}

export class InstanceListDto {
  instances!: InstanceStatusDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
