import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DedicatedInstance } from './entities/dedicated-instance.entity';
import { ResourceAllocation, ResourceType } from './entities/resource-allocation.entity';
import { InstanceConfig } from './entities/instance-config.entity';
import { ProvisionInstanceDto } from './dto/provision-instance.dto';
import { InstanceStatusDto, InstanceListDto } from './dto/instance-status.dto';
import { ResourceConfigDto, InstanceResourcesDto, ResourceUsageDto } from './dto/resource-config.dto';
import { InstanceStatus, InstanceSpec } from './interfaces/instance-spec.interface';
import { ProvisioningConfig } from './interfaces/provisioning-config.interface';
import { K8sProvisioner } from './utils/k8s-provisioner';
import { ResourceCalculator } from './utils/resource-calculator';

@Injectable()
export class InstanceProvisionerService {
  private readonly logger = new Logger(InstanceProvisionerService.name);
  private readonly k8sProvisioner: K8sProvisioner;

  constructor(
    @InjectRepository(DedicatedInstance)
    private readonly instanceRepo: Repository<DedicatedInstance>,
    @InjectRepository(ResourceAllocation)
    private readonly resourceRepo: Repository<ResourceAllocation>,
    @InjectRepository(InstanceConfig)
    private readonly configRepo: Repository<InstanceConfig>,
  ) {
    this.k8sProvisioner = new K8sProvisioner();
  }

  async provisionInstance(dto: ProvisionInstanceDto): Promise<DedicatedInstance> {
    this.logger.log(`Provisioning instance ${dto.instanceName} for user ${dto.userId}`);

    const spec: InstanceSpec = {
      cpu: dto.cpu,
      memory: dto.memory,
      storage: dto.storage,
      bandwidth: dto.bandwidth,
      maxConnections: dto.maxConnections,
      dedicatedIp: dto.dedicatedIp ?? false,
      isolationLevel: (dto.isolationLevel as any) ?? 'pod',
    };

    const validation = ResourceCalculator.validateResourceLimits(spec);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid resource limits: ${validation.errors.join(', ')}`);
    }

    const instance = this.instanceRepo.create({
      userId: dto.userId,
      instanceName: dto.instanceName,
      type: dto.type,
      status: InstanceStatus.PROVISIONING,
      isolationLevel: spec.isolationLevel,
      namespace: `vip-${dto.userId.substring(0, 8)}`,
      replicaCount: dto.replicaCount ?? 1,
      metadata: dto.metadata,
    });

    const savedInstance = await this.instanceRepo.save(instance);

    const provisioningConfig: ProvisioningConfig = {
      namespace: savedInstance.namespace,
      replicaCount: savedInstance.replicaCount,
      imageTag: 'latest',
      environmentVariables: {
        NODE_ENV: 'production',
        INSTANCE_ID: savedInstance.id,
        USER_ID: dto.userId,
      },
      secrets: {},
      labels: {
        'app.kubernetes.io/name': dto.instanceName,
        'app.kubernetes.io/instance': savedInstance.id,
        'app.kubernetes.io/managed-by': 'stellarswipe',
      },
      annotations: {
        'stellarswipe.io/user-id': dto.userId,
        'stellarswipe.io/instance-type': dto.type,
      },
      autoScaling: {
        enabled: false,
        minReplicas: 1,
        maxReplicas: 3,
        targetCPUUtilization: 70,
        targetMemoryUtilization: 80,
      },
      healthCheck: {
        enabled: true,
        path: '/health',
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
      persistence: {
        enabled: true,
        storageClass: 'fast-ssd',
        size: `${spec.storage}Gi`,
      },
    };

    try {
      const result = await this.k8sProvisioner.provisionInstance(
        savedInstance.id,
        dto.instanceName,
        spec,
        provisioningConfig,
      );

      savedInstance.deploymentName = result.deploymentName;
      savedInstance.serviceName = result.serviceName;
      savedInstance.ingressUrl = result.ingressUrl;
      savedInstance.status = InstanceStatus.ACTIVE;
      savedInstance.provisionedAt = new Date();

      await this.instanceRepo.save(savedInstance);

      await this.createResourceAllocations(savedInstance.id, spec);

      this.logger.log(`Instance ${savedInstance.id} provisioned successfully`);

      return savedInstance;
    } catch (error) {
      this.logger.error(`Failed to provision instance ${savedInstance.id}:`, error);
      savedInstance.status = InstanceStatus.TERMINATED;
      await this.instanceRepo.save(savedInstance);
      throw error;
    }
  }

  async getInstance(instanceId: string): Promise<DedicatedInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: ['resourceAllocations'],
    });

    if (!instance) {
      throw new NotFoundException(`Instance ${instanceId} not found`);
    }

    return instance;
  }

  async getInstanceStatus(instanceId: string): Promise<InstanceStatusDto> {
    const instance = await this.getInstance(instanceId);

    const status: InstanceStatusDto = {
      id: instance.id,
      userId: instance.userId,
      instanceName: instance.instanceName,
      status: instance.status,
      ingressUrl: instance.ingressUrl,
      dedicatedIp: instance.dedicatedIp,
      provisionedAt: instance.provisionedAt,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    };

    if (instance.status === InstanceStatus.ACTIVE && instance.deploymentName) {
      const k8sStatus = await this.k8sProvisioner.getInstanceStatus(
        instance.namespace,
        instance.deploymentName,
      );

      status.health = {
        overall: k8sStatus.ready === k8sStatus.total ? 'healthy' : 'degraded',
        checks: [
          {
            name: 'deployment',
            status: k8sStatus.ready === k8sStatus.total ? 'pass' : 'fail',
            message: `${k8sStatus.ready}/${k8sStatus.total} replicas ready`,
          },
        ],
      };
    }

    return status;
  }

  async listUserInstances(userId: string, page = 1, pageSize = 10): Promise<InstanceListDto> {
    const [instances, total] = await this.instanceRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const instanceStatuses = await Promise.all(
      instances.map((instance) => this.getInstanceStatus(instance.id)),
    );

    return {
      instances: instanceStatuses,
      total,
      page,
      pageSize,
    };
  }

  async terminateInstance(instanceId: string): Promise<DedicatedInstance> {
    const instance = await this.getInstance(instanceId);

    if (instance.status === InstanceStatus.TERMINATED) {
      throw new BadRequestException('Instance is already terminated');
    }

    this.logger.log(`Terminating instance ${instanceId}`);

    instance.status = InstanceStatus.TERMINATING;
    await this.instanceRepo.save(instance);

    if (instance.deploymentName && instance.serviceName) {
      await this.k8sProvisioner.terminateInstance(
        instance.namespace,
        instance.deploymentName,
        instance.serviceName,
      );
    }

    instance.status = InstanceStatus.TERMINATED;
    instance.terminatedAt = new Date();
    return this.instanceRepo.save(instance);
  }

  async scaleInstance(instanceId: string, replicaCount: number): Promise<DedicatedInstance> {
    const instance = await this.getInstance(instanceId);

    if (instance.status !== InstanceStatus.ACTIVE) {
      throw new BadRequestException('Can only scale active instances');
    }

    if (!instance.deploymentName) {
      throw new BadRequestException('Instance deployment not found');
    }

    this.logger.log(`Scaling instance ${instanceId} to ${replicaCount} replicas`);

    instance.status = InstanceStatus.SCALING;
    await this.instanceRepo.save(instance);

    await this.k8sProvisioner.scaleInstance(
      instance.namespace,
      instance.deploymentName,
      replicaCount,
    );

    instance.replicaCount = replicaCount;
    instance.status = InstanceStatus.ACTIVE;
    return this.instanceRepo.save(instance);
  }

  async getInstanceResources(instanceId: string): Promise<InstanceResourcesDto> {
    const instance = await this.getInstance(instanceId);
    const allocations = await this.resourceRepo.find({ where: { instanceId } });

    const resources: ResourceUsageDto[] = allocations.map((allocation) => {
      const allocated = parseFloat(allocation.allocatedAmount);
      const used = parseFloat(allocation.usedAmount);
      const utilization = ResourceCalculator.calculateUtilization(allocated, used);
      const threshold = allocation.thresholdPercent;
      const thresholdExceeded = ResourceCalculator.isThresholdExceeded(
        allocated,
        used,
        threshold,
      );

      return {
        resourceType: allocation.resourceType,
        allocatedAmount: allocated,
        usedAmount: used,
        unit: allocation.unit,
        utilizationPercent: utilization,
        limitAmount: allocation.limitAmount ? parseFloat(allocation.limitAmount) : undefined,
        thresholdExceeded,
      };
    });

    const overallUtilization = ResourceCalculator.calculateOverallUtilization(
      resources.map((r) => ({ allocated: r.allocatedAmount, used: r.usedAmount })),
    );

    const alerts = resources
      .filter((r) => r.thresholdExceeded)
      .map((r) => ({
        resourceType: r.resourceType,
        message: `${r.resourceType} utilization at ${r.utilizationPercent.toFixed(2)}%`,
        severity: r.utilizationPercent > 95 ? 'critical' as const : 'warning' as const,
      }));

    return {
      instanceId: instance.id,
      instanceName: instance.instanceName,
      resources,
      overallUtilization,
      alerts,
    };
  }

  async updateResourceAllocation(dto: ResourceConfigDto): Promise<ResourceAllocation> {
    const allocation = await this.resourceRepo.findOne({
      where: {
        instanceId: dto.instanceId,
        resourceType: dto.resourceType,
      },
    });

    if (!allocation) {
      throw new NotFoundException('Resource allocation not found');
    }

    allocation.allocatedAmount = dto.allocatedAmount.toString();
    allocation.unit = dto.unit;
    if (dto.limitAmount) allocation.limitAmount = dto.limitAmount.toString();
    if (dto.thresholdPercent) allocation.thresholdPercent = dto.thresholdPercent;

    return this.resourceRepo.save(allocation);
  }

  async setInstanceConfig(
    instanceId: string,
    key: string,
    value: string,
    isSecret = false,
  ): Promise<InstanceConfig> {
    let config = await this.configRepo.findOne({
      where: { instanceId, configKey: key },
    });

    if (config) {
      config.configValue = value;
      config.isSecret = isSecret;
    } else {
      config = this.configRepo.create({
        instanceId,
        configKey: key,
        configValue: value,
        isSecret,
      });
    }

    return this.configRepo.save(config);
  }

  async getInstanceConfig(instanceId: string): Promise<InstanceConfig[]> {
    return this.configRepo.find({ where: { instanceId } });
  }

  private async createResourceAllocations(
    instanceId: string,
    spec: InstanceSpec,
  ): Promise<void> {
    const allocations = [
      {
        instanceId,
        resourceType: ResourceType.CPU,
        allocatedAmount: spec.cpu.toString(),
        usedAmount: '0',
        unit: 'cores',
        limitAmount: spec.cpu.toString(),
      },
      {
        instanceId,
        resourceType: ResourceType.MEMORY,
        allocatedAmount: spec.memory.toString(),
        usedAmount: '0',
        unit: 'GB',
        limitAmount: spec.memory.toString(),
      },
      {
        instanceId,
        resourceType: ResourceType.STORAGE,
        allocatedAmount: spec.storage.toString(),
        usedAmount: '0',
        unit: 'GB',
        limitAmount: spec.storage.toString(),
      },
      {
        instanceId,
        resourceType: ResourceType.BANDWIDTH,
        allocatedAmount: spec.bandwidth.toString(),
        usedAmount: '0',
        unit: 'Mbps',
        limitAmount: spec.bandwidth.toString(),
      },
    ];

    await this.resourceRepo.save(allocations.map((a) => this.resourceRepo.create(a)));
  }
}
