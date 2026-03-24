import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { InstanceType, InstanceStatus } from '../interfaces/instance-spec.interface';
import { ResourceAllocation } from './resource-allocation.entity';

@Entity('dedicated_instances')
@Index(['userId', 'status'])
export class DedicatedInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  @Index()
  userId!: string;

  @Column({ name: 'instance_name', length: 255 })
  instanceName!: string;

  @Column({ type: 'enum', enum: InstanceType })
  @Index()
  type!: InstanceType;

  @Column({ type: 'enum', enum: InstanceStatus, default: InstanceStatus.PROVISIONING })
  @Index()
  status!: InstanceStatus;

  @Column({ name: 'deployment_name', length: 255, nullable: true })
  deploymentName?: string;

  @Column({ name: 'service_name', length: 255, nullable: true })
  serviceName?: string;

  @Column({ name: 'ingress_url', length: 500, nullable: true })
  ingressUrl?: string;

  @Column({ name: 'dedicated_ip', length: 45, nullable: true })
  dedicatedIp?: string;

  @Column({ name: 'isolation_level', length: 50, default: 'pod' })
  isolationLevel!: string;

  @Column({ name: 'namespace', length: 255 })
  namespace!: string;

  @Column({ name: 'replica_count', type: 'int', default: 1 })
  replicaCount!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'provisioned_at', type: 'timestamp', nullable: true })
  provisionedAt?: Date;

  @Column({ name: 'terminated_at', type: 'timestamp', nullable: true })
  terminatedAt?: Date;

  @OneToMany(() => ResourceAllocation, allocation => allocation.instance)
  resourceAllocations!: ResourceAllocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
