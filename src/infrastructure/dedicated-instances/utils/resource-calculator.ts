import { InstanceType, InstanceSpec } from '../interfaces/instance-spec.interface';

export class ResourceCalculator {
  static calculateResourcesForType(type: InstanceType): InstanceSpec {
    switch (type) {
      case InstanceType.STANDARD:
        return {
          cpu: 2,
          memory: 4,
          storage: 50,
          bandwidth: 1000,
          maxConnections: 500,
          dedicatedIp: false,
          isolationLevel: 'pod',
        };

      case InstanceType.PERFORMANCE:
        return {
          cpu: 8,
          memory: 16,
          storage: 200,
          bandwidth: 5000,
          maxConnections: 2000,
          dedicatedIp: true,
          isolationLevel: 'pod',
        };

      case InstanceType.ENTERPRISE:
        return {
          cpu: 32,
          memory: 64,
          storage: 1000,
          bandwidth: 20000,
          maxConnections: 10000,
          dedicatedIp: true,
          isolationLevel: 'node',
        };

      default:
        return this.calculateResourcesForType(InstanceType.STANDARD);
    }
  }

  static calculateUtilization(allocated: number, used: number): number {
    if (allocated === 0) return 0;
    return (used / allocated) * 100;
  }

  static isThresholdExceeded(
    allocated: number,
    used: number,
    threshold: number,
  ): boolean {
    const utilization = this.calculateUtilization(allocated, used);
    return utilization >= threshold;
  }

  static calculateOverallUtilization(resources: Array<{ allocated: number; used: number }>): number {
    if (resources.length === 0) return 0;

    const totalUtilization = resources.reduce((sum, resource) => {
      return sum + this.calculateUtilization(resource.allocated, resource.used);
    }, 0);

    return totalUtilization / resources.length;
  }

  static estimateCost(spec: InstanceSpec, hours: number): number {
    const cpuCost = spec.cpu * 0.05;
    const memoryCost = spec.memory * 0.01;
    const storageCost = spec.storage * 0.0001;
    const bandwidthCost = spec.bandwidth * 0.00001;

    const hourlyCost = cpuCost + memoryCost + storageCost + bandwidthCost;
    return hourlyCost * hours;
  }

  static validateResourceLimits(spec: InstanceSpec): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (spec.cpu < 1 || spec.cpu > 64) {
      errors.push('CPU must be between 1 and 64 cores');
    }

    if (spec.memory < 1 || spec.memory > 256) {
      errors.push('Memory must be between 1 and 256 GB');
    }

    if (spec.storage < 10 || spec.storage > 10000) {
      errors.push('Storage must be between 10 and 10000 GB');
    }

    if (spec.bandwidth < 100 || spec.bandwidth > 100000) {
      errors.push('Bandwidth must be between 100 and 100000 Mbps');
    }

    if (spec.maxConnections < 10 || spec.maxConnections > 100000) {
      errors.push('Max connections must be between 10 and 100000');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
