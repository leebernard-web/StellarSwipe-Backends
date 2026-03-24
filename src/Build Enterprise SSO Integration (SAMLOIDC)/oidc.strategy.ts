import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, TokenSet, UserinfoResponse } from 'openid-client';
import { Request } from 'express';
import { OidcService } from '../oidc.service';
import { SsoUserDto } from '../dto/sso-user.dto';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  private readonly logger = new Logger(OidcStrategy.name);

  constructor(private readonly oidcService: OidcService) {
    // Stub options — actual client is resolved per-request by OidcService.
    super({ client: null as any } as StrategyOptions);
  }

  /**
   * Called by Passport after a successful OIDC token exchange.
   * Maps IdP userinfo claims to a local user DTO.
   */
  async validate(
    req: Request,
    tokenSet: TokenSet,
    userinfo: UserinfoResponse,
  ): Promise<SsoUserDto> {
    const organizationId: string = (req as Request & { organizationId?: string }).organizationId ?? '';

    this.logger.log(`OIDC callback received for organization: ${organizationId}`);

    try {
      const user = await this.oidcService.validateUserInfo(userinfo, tokenSet, organizationId);
      return user;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'OIDC validation failed';
      this.logger.error('OIDC user validation failed', { organizationId, error: message });
      throw new UnauthorizedException(`OIDC authentication failed: ${message}`);
    }
  }
}
