import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, SamlConfig, Profile } from '@node-saml/passport-saml';
import { Request } from 'express';
import { SamlService } from '../saml.service';
import { SsoUserDto } from '../dto/sso-user.dto';

@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  private readonly logger = new Logger(SamlStrategy.name);

  constructor(private readonly samlService: SamlService) {
    // Config will be loaded dynamically per request; pass a stub here.
    // Dynamic multi-tenant SAML is handled via the controller calling samlService directly.
    super({
      passReqToCallback: true,
      // Minimal defaults; per-org config is resolved in the controller.
      entryPoint: 'PLACEHOLDER',
      issuer: 'PLACEHOLDER',
      cert: 'PLACEHOLDER',
      callbackUrl: 'PLACEHOLDER',
    } as SamlConfig);
  }

  /**
   * Called by Passport after successful SAML assertion validation.
   * Maps the IdP profile to a local user DTO.
   */
  async validate(req: Request, profile: Profile): Promise<SsoUserDto> {
    const organizationId: string = (req as Request & { organizationId?: string }).organizationId ?? '';

    this.logger.log(`SAML assertion received for organization: ${organizationId}`);

    try {
      const user = await this.samlService.validateAssertion(profile, organizationId);
      return user;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SAML validation failed';
      this.logger.error('SAML assertion validation failed', { organizationId, error: message });
      throw new UnauthorizedException(`SAML authentication failed: ${message}`);
    }
  }
}
