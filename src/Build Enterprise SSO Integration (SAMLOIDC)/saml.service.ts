import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from '@node-saml/passport-saml';
import { SsoProvider, SsoProtocol } from './entities/sso-provider.entity';
import { SsoMapping } from './entities/sso-mapping.entity';
import { SamlConfigDto } from './dto/saml-config.dto';
import { SsoUserDto } from './dto/sso-user.dto';
import { parseSamlAttributes, validateSamlCert } from './utils/saml-parser';
import { AttributeMapping } from './interfaces/attribute-mapping.interface';

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);

  constructor(
    @InjectRepository(SsoProvider)
    private readonly providerRepo: Repository<SsoProvider>,

    @InjectRepository(SsoMapping)
    private readonly mappingRepo: Repository<SsoMapping>,
  ) {}

  /**
   * Returns the SAML provider config for a given organization.
   */
  async getProviderConfig(organizationId: string): Promise<SsoProvider> {
    const provider = await this.providerRepo.findOne({
      where: { organizationId, protocol: SsoProtocol.SAML, isActive: true },
      relations: ['mapping'],
    });

    if (!provider) {
      throw new NotFoundException(
        `No active SAML provider found for organization: ${organizationId}`,
      );
    }

    return provider;
  }

  /**
   * Builds the passport-saml options object for a given organization.
   */
  async buildSamlOptions(organizationId: string) {
    const provider = await this.getProviderConfig(organizationId);

    return {
      entryPoint: provider.entryPoint!,
      issuer: provider.issuer!,
      cert: provider.cert!,
      callbackUrl: provider.callbackUrl,
      signatureAlgorithm: provider.signatureAlgorithm as 'sha1' | 'sha256' | 'sha512' | undefined,
      identifierFormat: provider.identifierFormat,
      wantAuthnResponseSigned: provider.wantAuthnResponseSigned,
      wantAssertionsSigned: provider.wantAssertionsSigned,
      privateKey: provider.privateKey,
      passReqToCallback: true,
    };
  }

  /**
   * Validates a SAML assertion profile and maps it to a local SsoUserDto.
   */
  async validateAssertion(profile: Profile, organizationId: string): Promise<SsoUserDto> {
    const provider = await this.getProviderConfig(organizationId);

    const rawAttributes = profile as unknown as Record<string, unknown>;
    const mapping = this.buildAttributeMapping(provider);

    const userAttributes = parseSamlAttributes(rawAttributes, mapping);

    this.logger.log(`SAML user authenticated: ${userAttributes.email}`, {
      organizationId,
      providerId: provider.id,
    });

    return {
      email: userAttributes.email,
      firstName: userAttributes.firstName,
      lastName: userAttributes.lastName,
      username: userAttributes.username,
      displayName: userAttributes.displayName,
      roles: userAttributes.roles,
      groups: userAttributes.groups,
      rawAttributes: userAttributes.rawAttributes,
      providerId: provider.id,
      protocol: 'saml',
    };
  }

  /**
   * Registers or updates a SAML provider for an organization.
   */
  async configureProvider(
    organizationId: string,
    config: SamlConfigDto,
  ): Promise<SsoProvider> {
    if (!validateSamlCert(config.cert)) {
      throw new BadRequestException('Invalid SAML certificate — must be a valid PEM certificate.');
    }

    const existing = await this.providerRepo.findOne({
      where: { organizationId, protocol: SsoProtocol.SAML },
      relations: ['mapping'],
    });

    if (existing) {
      throw new ConflictException(
        `SAML provider already exists for organization ${organizationId}. Use PUT to update.`,
      );
    }

    const provider = this.providerRepo.create({
      organizationId,
      protocol: SsoProtocol.SAML,
      providerName: config.providerName ?? 'SAML IdP',
      entryPoint: config.entryPoint,
      issuer: config.issuer,
      cert: config.cert,
      callbackUrl: config.callbackUrl,
      signatureAlgorithm: config.signatureAlgorithm ?? 'sha256',
      identifierFormat: config.identifierFormat,
      wantAuthnResponseSigned: config.wantAuthnResponseSigned ?? true,
      wantAssertionsSigned: config.wantAssertionsSigned ?? true,
      privateKey: config.privateKey,
      isActive: true,
    });

    const saved = await this.providerRepo.save(provider);

    // Create attribute mapping
    const attrMapping = this.mappingRepo.create({
      providerId: saved.id,
      emailField: config.attributeMapping?.emailField ?? 'email',
      firstNameField: config.attributeMapping?.firstNameField,
      lastNameField: config.attributeMapping?.lastNameField,
      usernameField: config.attributeMapping?.usernameField,
      displayNameField: config.attributeMapping?.displayNameField,
      autoProvisionUsers: true,
      updateOnLogin: true,
    });

    await this.mappingRepo.save(attrMapping);

    this.logger.log(`SAML provider configured for organization: ${organizationId}`);
    return this.providerRepo.findOne({ where: { id: saved.id }, relations: ['mapping'] }) as Promise<SsoProvider>;
  }

  /**
   * Updates an existing SAML provider config.
   */
  async updateProvider(
    organizationId: string,
    config: Partial<SamlConfigDto>,
  ): Promise<SsoProvider> {
    const provider = await this.getProviderConfig(organizationId);

    if (config.cert && !validateSamlCert(config.cert)) {
      throw new BadRequestException('Invalid SAML certificate format.');
    }

    Object.assign(provider, {
      ...(config.entryPoint && { entryPoint: config.entryPoint }),
      ...(config.issuer && { issuer: config.issuer }),
      ...(config.cert && { cert: config.cert }),
      ...(config.callbackUrl && { callbackUrl: config.callbackUrl }),
      ...(config.signatureAlgorithm && { signatureAlgorithm: config.signatureAlgorithm }),
      ...(config.identifierFormat !== undefined && { identifierFormat: config.identifierFormat }),
      ...(config.wantAuthnResponseSigned !== undefined && {
        wantAuthnResponseSigned: config.wantAuthnResponseSigned,
      }),
      ...(config.wantAssertionsSigned !== undefined && {
        wantAssertionsSigned: config.wantAssertionsSigned,
      }),
      ...(config.providerName && { providerName: config.providerName }),
    });

    return this.providerRepo.save(provider);
  }

  /**
   * Toggles SAML provider active state.
   */
  async toggleProvider(organizationId: string, isActive: boolean): Promise<void> {
    const provider = await this.getProviderConfig(organizationId);
    provider.isActive = isActive;
    await this.providerRepo.save(provider);
  }

  /**
   * Builds an AttributeMapping object from a provider's stored mapping.
   */
  private buildAttributeMapping(provider: SsoProvider): AttributeMapping {
    const m = provider.mapping;
    return {
      id: m?.id ?? '',
      providerId: provider.id,
      emailField: m?.emailField ?? 'email',
      firstNameField: m?.firstNameField,
      lastNameField: m?.lastNameField,
      usernameField: m?.usernameField,
      displayNameField: m?.displayNameField,
      rolesField: m?.rolesField,
      groupsField: m?.groupsField,
      roleMapping: m?.roleMapping,
      customMappings: m?.customMappings,
    };
  }
}
