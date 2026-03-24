import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('instance_configs')
@Index(['instanceId'])
export class InstanceConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'instance_id' })
  @Index()
  instanceId!: string;

  @Column({ name: 'config_key', length: 255 })
  configKey!: string;

  @Column({ name: 'config_value', type: 'text' })
  configValue!: string;

  @Column({ name: 'is_secret', default: false })
  isSecret!: boolean;

  @Column({ name: 'is_encrypted', default: false })
  isEncrypted!: boolean;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
