import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstanceProvisionerService } from './instance-provisioner.service';
import { InstanceController } from './instance.controller';
import { DedicatedInstance } from './entities/dedicated-instance.entity';
import { ResourceAllocation } from './entities/resource-allocation.entity';
import { InstanceConfig } from './entities/instance-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DedicatedInstance,
      ResourceAllocation,
      InstanceConfig,
    ]),
  ],
  controllers: [InstanceController],
  providers: [InstanceProvisionerService],
  exports: [InstanceProvisionerService],
})
export class DedicatedInstancesModule {}
