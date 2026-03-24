import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SsoMapping } from './sso-mapping.entity';

export enum SsoProtocol {
  SAML = 'saml',
  OIDC = 'oidc',
}

@Entity('sso_providers')
@Index(['organizationId', 'protocol'], { unique: true })
export class SsoProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({ type: 'enum', enum: SsoProtocol })
  protocol: SsoProtocol;

  @Column({ name: 'provider_name' })
  providerName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // SAML-specific fields
  @Column({ name: 'entry_point', nullable: true })
  entryPoint?: string;

  @Column({ nullable: true })
  issuer?: string;

  @Column({ type: 'text', nullable: true })
  cert?: string;

  @Column({ name: 'signature_algorithm', nullable: true })
  signatureAlgorithm?: string;

  @Column({ name: 'identifier_format', nullable: true })
  identifierFormat?: string;

  @Column({ name: 'want_authn_response_signed', default: true })
  wantAuthnResponseSigned: boolean;

  @Column({ name: 'want_assertions_signed', default: true })
  wantAssertionsSigned: boolean;

  @Column({ name: 'private_key', type: 'text', nullable: true })
  privateKey?: string;

  // OIDC-specific fields
  @Column({ name: 'client_id', nullable: true })
  clientId?: string;

  @Column({ name: 'client_secret', nullable: true })
  clientSecret?: string;

  @Column({ name: 'discovery_url', nullable: true })
  discoveryUrl?: string;

  @Column({ name: 'authorization_url', nullable: true })
  authorizationUrl?: string;

  @Column({ name: 'token_url', nullable: true })
  tokenUrl?: string;

  @Column({ name: 'user_info_url', nullable: true })
  userInfoUrl?: string;

  @Column({ name: 'jwks_uri', nullable: true })
  jwksUri?: string;

  @Column({ name: 'callback_url' })
  callbackUrl: string;

  @Column({ type: 'simple-array', nullable: true })
  scope?: string[];

  @Column({ name: 'response_type', nullable: true })
  responseType?: string;

  @OneToOne(() => SsoMapping, (mapping) => mapping.provider, { cascade: true, eager: true })
  mapping: SsoMapping;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
