import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstanceProvisionerService } from './instance-provisioner.service';
import { DedicatedInstance } from './entities/dedicated-instance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';
import { InstanceConfig } from './entities/instance-config.entity';
import { InstanceType, InstanceStatus } from './interfaces/instance-spec.interface';
import { ProvisionInstanceDto } from './dto/provision-instance.dto';

describe('InstanceProvisionerService', () => {
  let service: InstanceProvisionerService;
  let instanceRepo: Repository<DedicatedInstance>;
  let resourceRepo: Repository<ResourceAllocation>;
  let configRepo: Repository<InstanceConfig>;

  const mockInstanceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockResourceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockConfigRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstanceProvisionerService,
        {
          provide: getRepositoryToken(DedicatedInstance),
          useValue: mockInstanceRepository,
        },
        {
          provide: getRepositoryToken(ResourceAllocation),
          useValue: mockResourceRepository,
        },
        {
          provide: getRepositoryToken(InstanceConfig),
          useValue: mockConfigRepository,
        },
      ],
    }).compile();

    service = module.get<InstanceProvisionerService>(InstanceProvisionerService);
    instanceRepo = module.get<Repository<DedicatedInstance>>(
      getRepositoryToken(DedicatedInstance),
    );
    resourceRepo = module.get<Repository<ResourceAllocation>>(
      getRepositoryToken(ResourceAllocation),
    );
    configRepo = module.get<Repository<InstanceConfig>>(
      getRepositoryToken(InstanceConfig),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('provisionInstance', () => {
    it('should provision a new instance', async () => {
      const dto: ProvisionInstanceDto = {
        userId: 'user-123',
        instanceName: 'test-instance',
        type: InstanceType.STANDARD,
        cpu: 2,
        memory: 4,
        storage: 50,
        bandwidth: 1000,
        maxConnections: 500,
      };

      const mockInstance = {
        id: 'instance-123',
        ...dto,
        status: InstanceStatus.PROVISIONING,
        namespace: 'vip-user-123',
        replicaCount: 1,
      };

      mockInstanceRepository.create.mockReturnValue(mockInstance);
      mockInstanceRepository.save.mockResolvedValue(mockInstance);
      mockResourceRepository.save.mockResolvedValue([]);

      const result = await service.provisionInstance(dto);

      expect(mockInstanceRepository.create).toHaveBeenCalled();
      expect(mockInstanceRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error for invalid resource limits', async () => {
      const dto: ProvisionInstanceDto = {
        userId: 'user-123',
        instanceName: 'test-instance',
        type: InstanceType.STANDARD,
        cpu: 100,
        memory: 4,
        storage: 50,
        bandwidth: 1000,
        maxConnections: 500,
      };

      await expect(service.provisionInstance(dto)).rejects.toThrow();
    });
  });

  describe('getInstance', () => {
    it('should return instance by id', async () => {
      const mockInstance = {
        id: 'instance-123',
        userId: 'user-123',
        instanceName: 'test-instance',
        status: InstanceStatus.ACTIVE,
      };

      mockInstanceRepository.findOne.mockResolvedValue(mockInstance);

      const result = await service.getInstance('instance-123');

      expect(result).toEqual(mockInstance);
      expect(mockInstanceRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'instance-123' },
        relations: ['resourceAllocations'],
      });
    });

    it('should throw NotFoundException when instance not found', async () => {
      mockInstanceRepository.findOne.mockResolvedValue(null);

      await expect(service.getInstance('invalid-id')).rejects.toThrow();
    });
  });

  describe('terminateInstance', () => {
    it('should terminate an active instance', async () => {
      const mockInstance = {
        id: 'instance-123',
        userId: 'user-123',
        instanceName: 'test-instance',
        status: InstanceStatus.ACTIVE,
        deploymentName: 'deployment-123',
        serviceName: 'service-123',
        namespace: 'vip-user-123',
      };

      mockInstanceRepository.findOne.mockResolvedValue(mockInstance);
      mockInstanceRepository.save.mockResolvedValue({
        ...mockInstance,
        status: InstanceStatus.TERMINATED,
      });

      const result = await service.terminateInstance('instance-123');

      expect(result.status).toBe(InstanceStatus.TERMINATED);
      expect(mockInstanceRepository.save).toHaveBeenCalled();
    });

    it('should throw error when terminating already terminated instance', async () => {
      const mockInstance = {
        id: 'instance-123',
        status: InstanceStatus.TERMINATED,
      };

      mockInstanceRepository.findOne.mockResolvedValue(mockInstance);

      await expect(service.terminateInstance('instance-123')).rejects.toThrow();
    });
  });

  describe('scaleInstance', () => {
    it('should scale an active instance', async () => {
      const mockInstance = {
        id: 'instance-123',
        userId: 'user-123',
        status: InstanceStatus.ACTIVE,
        deploymentName: 'deployment-123',
        namespace: 'vip-user-123',
        replicaCount: 1,
      };

      mockInstanceRepository.findOne.mockResolvedValue(mockInstance);
      mockInstanceRepository.save.mockResolvedValue({
        ...mockInstance,
        replicaCount: 3,
      });

      const result = await service.scaleInstance('instance-123', 3);

      expect(result.replicaCount).toBe(3);
      expect(mockInstanceRepository.save).toHaveBeenCalled();
    });

    it('should throw error when scaling non-active instance', async () => {
      const mockInstance = {
        id: 'instance-123',
        status: InstanceStatus.PROVISIONING,
      };

      mockInstanceRepository.findOne.mockResolvedValue(mockInstance);

      await expect(service.scaleInstance('instance-123', 3)).rejects.toThrow();
    });
  });

  describe('getInstanceResources', () => {
    it('should return instance resource usage', async () => {
      const mockInstance = {
        id: 'instance-123',
        instanceName: 'test-instance',
      };

      const mockAllocations = [
        {
          resourceType: 'cpu',
          allocatedAmount: '2',
          usedAmount: '1',
          unit: 'cores',
          thresholdPercent: 80,
        },
      ];

      mockInstanceRepository.findOne.mockResolvedValue(mockInstance);
      mockResourceRepository.find.mockResolvedValue(mockAllocations);

      const result = await service.getInstanceResources('instance-123');

      expect(result).toBeDefined();
      expect(result.instanceId).toBe('instance-123');
      expect(result.resources).toHaveLength(1);
    });
  });

  describe('setInstanceConfig', () => {
    it('should create new config', async () => {
      const mockConfig = {
        instanceId: 'instance-123',
        configKey: 'NODE_ENV',
        configValue: 'production',
        isSecret: false,
      };

      mockConfigRepository.findOne.mockResolvedValue(null);
      mockConfigRepository.create.mockReturnValue(mockConfig);
      mockConfigRepository.save.mockResolvedValue(mockConfig);

      const result = await service.setInstanceConfig(
        'instance-123',
        'NODE_ENV',
        'production',
        false,
      );

      expect(result).toEqual(mockConfig);
      expect(mockConfigRepository.save).toHaveBeenCalled();
    });

    it('should update existing config', async () => {
      const existingConfig = {
        instanceId: 'instance-123',
        configKey: 'NODE_ENV',
        configValue: 'development',
        isSecret: false,
      };

      const updatedConfig = {
        ...existingConfig,
        configValue: 'production',
      };

      mockConfigRepository.findOne.mockResolvedValue(existingConfig);
      mockConfigRepository.save.mockResolvedValue(updatedConfig);

      const result = await service.setInstanceConfig(
        'instance-123',
        'NODE_ENV',
        'production',
        false,
      );

      expect(result.configValue).toBe('production');
      expect(mockConfigRepository.save).toHaveBeenCalled();
    });
  });
});
