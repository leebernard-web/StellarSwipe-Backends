import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issuer, Client, TokenSet, UserinfoResponse } from 'openid-client';
import { SsoProvider, SsoProtocol } from './entities/sso-provider.entity';
import { SsoMapping } from './entities/sso-mapping.entity';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { SsoUserDto } from './dto/sso-user.dto';
import { mapOidcClaims } from './utils/jwt-validator';
import { AttributeMapping } from './interfaces/attribute-mapping.interface';

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  // Cache initialized OIDC clients per provider ID to avoid repeated discovery
  private readonly clientCache = new Map<string, Client>();

  constructor(
    @InjectRepository(SsoProvider)
    private readonly providerRepo: Repository<SsoProvider>,

    @InjectRepository(SsoMapping)
    private readonly mappingRepo: Repository<SsoMapping>,
  ) {}

  /**
   * Returns the OIDC provider config for a given organization.
   */
  async getProviderConfig(organizationId: string): Promise<SsoProvider> {
    const provider = await this.providerRepo.findOne({
      where: { organizationId, protocol: SsoProtocol.OIDC, isActive: true },
      relations: ['mapping'],
    });

    if (!provider) {
      throw new NotFoundException(
        `No active OIDC provider found for organization: ${organizationId}`,
      );
    }

    return provider;
  }

  /**
   * Builds and caches an openid-client Client for a given provider.
   */
  async getOidcClient(organizationId: string): Promise<Client> {
    const provider = await this.getProviderConfig(organizationId);

    if (this.clientCache.has(provider.id)) {
      return this.clientCache.get(provider.id)!;
    }

    let issuer: Issuer<Client>;

    if (provider.discoveryUrl) {
      this.logger.log(`Discovering OIDC configuration from: ${provider.discoveryUrl}`);
      issuer = await Issuer.discover(provider.discoveryUrl);
    } else {
      // Manual configuration
      if (!provider.authorizationUrl || !provider.tokenUrl || !provider.jwksUri) {
        throw new BadRequestException(
          'Manual OIDC configuration requires authorizationUrl, tokenUrl, and jwksUri.',
        );
      }

      issuer = new Issuer({
        issuer: provider.issuer ?? 'unknown',
        authorization_endpoint: provider.authorizationUrl,
        token_endpoint: provider.tokenUrl,
        userinfo_endpoint: provider.userInfoUrl,
        jwks_uri: provider.jwksUri,
      });
    }

    const client = new issuer.Client({
      client_id: provider.clientId!,
      client_secret: provider.clientSecret!,
      redirect_uris: [provider.callbackUrl],
      response_types: [provider.responseType ?? 'code'],
    });

    this.clientCache.set(provider.id, client);
    this.logger.log(`OIDC client initialized for organization: ${organizationId}`);

    return client;
  }

  /**
   * Builds the authorization URL for initiating OIDC login.
   */
  async getAuthorizationUrl(organizationId: string, state: string): Promise<string> {
    const provider = await this.getProviderConfig(organizationId);
    const client = await this.getOidcClient(organizationId);

    const url = client.authorizationUrl({
      scope: (provider.scope ?? ['openid', 'email', 'profile']).join(' '),
      state,
      nonce: this.generateNonce(),
    });

    return url;
  }

  /**
   * Exchanges an authorization code for tokens and validates userinfo.
   */
  async handleCallback(
    organizationId: string,
    callbackParams: Record<string, string>,
    state: string,
  ): Promise<SsoUserDto> {
    const provider = await this.getProviderConfig(organizationId);
    const client = await this.getOidcClient(organizationId);

    const tokenSet = await client.callback(provider.callbackUrl, callbackParams, { state });

    const userinfo = await client.userinfo(tokenSet);

    return this.validateUserInfo(userinfo, tokenSet, organizationId);
  }

  /**
   * Maps OIDC userinfo claims to a local SsoUserDto.
   */
  async validateUserInfo(
    userinfo: UserinfoResponse,
    _tokenSet: TokenSet,
    organizationId: string,
  ): Promise<SsoUserDto> {
    const provider = await this.getProviderConfig(organizationId);
    const mapping = this.buildAttributeMapping(provider);

    const claims = userinfo as unknown as Record<string, unknown>;
    const userAttributes = mapOidcClaims(claims, mapping);

    this.logger.log(`OIDC user authenticated: ${userAttributes.email}`, {
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
      protocol: 'oidc',
    };
  }

  /**
   * Registers or updates an OIDC provider for an organization.
   */
  async configureProvider(
    organizationId: string,
    config: OidcConfigDto,
  ): Promise<SsoProvider> {
    const hasDiscovery = !!config.discoveryUrl;
    const hasManual =
      config.authorizationUrl && config.tokenUrl && config.jwksUri;

    if (!hasDiscovery && !hasManual) {
      throw new BadRequestException(
        'Provide either discoveryUrl or all of: authorizationUrl, tokenUrl, jwksUri.',
      );
    }

    const existing = await this.providerRepo.findOne({
      where: { organizationId, protocol: SsoProtocol.OIDC },
    });

    if (existing) {
      throw new ConflictException(
        `OIDC provider already exists for organization ${organizationId}. Use PUT to update.`,
      );
    }

    const provider = this.providerRepo.create({
      organizationId,
      protocol: SsoProtocol.OIDC,
      providerName: config.providerName ?? 'OIDC IdP',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      callbackUrl: config.callbackUrl,
      discoveryUrl: config.discoveryUrl,
      authorizationUrl: config.authorizationUrl,
      tokenUrl: config.tokenUrl,
      userInfoUrl: config.userInfoUrl,
      jwksUri: config.jwksUri,
      scope: config.scope,
      responseType: config.responseType ?? 'code',
      isActive: true,
    });

    const saved = await this.providerRepo.save(provider);

    const attrMapping = this.mappingRepo.create({
      providerId: saved.id,
      emailField: config.attributeMapping?.emailField ?? 'email',
      firstNameField: config.attributeMapping?.firstNameField ?? 'given_name',
      lastNameField: config.attributeMapping?.lastNameField ?? 'family_name',
      usernameField: config.attributeMapping?.usernameField ?? 'preferred_username',
      displayNameField: config.attributeMapping?.displayNameField ?? 'name',
      autoProvisionUsers: true,
      updateOnLogin: true,
    });

    await this.mappingRepo.save(attrMapping);

    // Invalidate client cache for this provider
    this.clientCache.delete(saved.id);

    this.logger.log(`OIDC provider configured for organization: ${organizationId}`);
    return this.providerRepo.findOne({ where: { id: saved.id }, relations: ['mapping'] }) as Promise<SsoProvider>;
  }

  /**
   * Updates an existing OIDC provider config and clears the client cache.
   */
  async updateProvider(
    organizationId: string,
    config: Partial<OidcConfigDto>,
  ): Promise<SsoProvider> {
    const provider = await this.getProviderConfig(organizationId);

    Object.assign(provider, {
      ...(config.clientId && { clientId: config.clientId }),
      ...(config.clientSecret && { clientSecret: config.clientSecret }),
      ...(config.callbackUrl && { callbackUrl: config.callbackUrl }),
      ...(config.discoveryUrl !== undefined && { discoveryUrl: config.discoveryUrl }),
      ...(config.authorizationUrl && { authorizationUrl: config.authorizationUrl }),
      ...(config.tokenUrl && { tokenUrl: config.tokenUrl }),
      ...(config.userInfoUrl && { userInfoUrl: config.userInfoUrl }),
      ...(config.jwksUri && { jwksUri: config.jwksUri }),
      ...(config.scope && { scope: config.scope }),
      ...(config.responseType && { responseType: config.responseType }),
      ...(config.providerName && { providerName: config.providerName }),
    });

    const saved = await this.providerRepo.save(provider);
    this.clientCache.delete(provider.id); // Force client re-initialization
    return saved;
  }

  private buildAttributeMapping(provider: SsoProvider): AttributeMapping {
    const m = provider.mapping;
    return {
      id: m?.id ?? '',
      providerId: provider.id,
      emailField: m?.emailField ?? 'email',
      firstNameField: m?.firstNameField ?? 'given_name',
      lastNameField: m?.lastNameField ?? 'family_name',
      usernameField: m?.usernameField ?? 'preferred_username',
      displayNameField: m?.displayNameField ?? 'name',
      rolesField: m?.rolesField,
      groupsField: m?.groupsField,
      roleMapping: m?.roleMapping,
      customMappings: m?.customMappings,
    };
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
