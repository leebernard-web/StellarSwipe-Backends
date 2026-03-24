export enum InstanceType {
  STANDARD = 'standard',
  PERFORMANCE = 'performance',
  ENTERPRISE = 'enterprise',
}

export enum InstanceStatus {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  SCALING = 'scaling',
  MAINTENANCE = 'maintenance',
  SUSPENDED = 'suspended',
  TERMINATING = 'terminating',
  TERMINATED = 'terminated',
}

export interface InstanceSpec {
  cpu: number;
  memory: number;
  storage: number;
  bandwidth: number;
  maxConnections: number;
  dedicatedIp: boolean;
  isolationLevel: 'container' | 'pod' | 'node';
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  bandwidthUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
}
