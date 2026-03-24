import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DedicatedInstance } from './dedicated-instance.entity';

export enum ResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  STORAGE = 'storage',
  BANDWIDTH = 'bandwidth',
}

@Entity('resource_allocations')
@Index(['instanceId', 'resourceType'])
export class ResourceAllocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'instance_id' })
  @Index()
  instanceId!: string;

  @Column({ type: 'enum', enum: ResourceType })
  resourceType!: ResourceType;

  @Column({ name: 'allocated_amount', type: 'decimal', precision: 12, scale: 4 })
  allocatedAmount!: string;

  @Column({ name: 'used_amount', type: 'decimal', precision: 12, scale: 4, default: 0 })
  usedAmount!: string;

  @Column({ length: 20 })
  unit!: string;

  @Column({ name: 'limit_amount', type: 'decimal', precision: 12, scale: 4, nullable: true })
  limitAmount?: string;

  @Column({ name: 'threshold_percent', type: 'int', default: 80 })
  thresholdPercent!: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: Record<string, unknown>;

  @ManyToOne(() => DedicatedInstance, instance => instance.resourceAllocations)
  @JoinColumn({ name: 'instance_id' })
  instance!: DedicatedInstance;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
