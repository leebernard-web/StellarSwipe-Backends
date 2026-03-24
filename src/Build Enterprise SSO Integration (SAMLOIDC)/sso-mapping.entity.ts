import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { SsoProvider } from './sso-provider.entity';

@Entity('sso_mappings')
export class SsoMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => SsoProvider, (provider) => provider.mapping, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: SsoProvider;

  @Column({ name: 'provider_id' })
  providerId: string;

  // Standard user field mappings
  @Column({ name: 'email_field', default: 'email' })
  emailField: string;

  @Column({ name: 'first_name_field', nullable: true })
  firstNameField?: string;

  @Column({ name: 'last_name_field', nullable: true })
  lastNameField?: string;

  @Column({ name: 'username_field', nullable: true })
  usernameField?: string;

  @Column({ name: 'display_name_field', nullable: true })
  displayNameField?: string;

  // Role/group mapping
  @Column({ name: 'roles_field', nullable: true })
  rolesField?: string;

  @Column({ name: 'groups_field', nullable: true })
  groupsField?: string;

  @Column({ name: 'role_mapping', type: 'jsonb', nullable: true })
  roleMapping?: Record<string, string[]>;

  // Custom attribute mappings stored as JSON
  @Column({ name: 'custom_mappings', type: 'jsonb', nullable: true })
  customMappings?: Array<{
    sourceAttribute: string;
    targetField: string;
    transform?: 'lowercase' | 'uppercase' | 'trim' | 'none';
    defaultValue?: string;
  }>;

  @Column({ name: 'auto_provision_users', default: true })
  autoProvisionUsers: boolean;

  @Column({ name: 'update_on_login', default: true })
  updateOnLogin: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
