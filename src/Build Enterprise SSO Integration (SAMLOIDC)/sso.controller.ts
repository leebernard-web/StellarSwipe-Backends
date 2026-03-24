import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SamlService } from './saml.service';
import { OidcService } from './oidc.service';
import { SamlConfigDto } from './dto/saml-config.dto';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { SsoUserDto } from './dto/sso-user.dto';
import * as SamlLib from '@node-saml/node-saml';

interface RequestWithOrgId extends Request {
  organizationId?: string;
  user?: SsoUserDto;
}

@ApiTags('SSO')
@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly samlService: SamlService,
    private readonly oidcService: OidcService,
  ) {}

  // ─── SAML Endpoints ────────────────────────────────────────────────────────

  @Get('saml/:organizationId/login')
  @ApiOperation({ summary: 'Initiate SAML login — redirects to IdP' })
  @ApiParam({ name: 'organizationId', description: 'Organization identifier' })
  async samlLogin(
    @Param('organizationId') organizationId: string,
    @Req() req: RequestWithOrgId,
    @Res() res: Response,
  ): Promise<void> {
    req.organizationId = organizationId;
    const options = await this.samlService.buildSamlOptions(organizationId);
    const saml = new SamlLib.SAML(options);
    const url = await saml.getAuthorizeUrlAsync('', req.query as Record<string, string>, {});
    res.redirect(url);
  }

  @Post('saml/:organizationId/callback')
  @ApiOperation({ summary: 'SAML assertion consumer service (ACS) endpoint' })
  @ApiParam({ name: 'organizationId', description: 'Organization identifier' })
  @ApiResponse({ status: 200, type: SsoUserDto })
  async samlCallback(
    @Param('organizationId') organizationId: string,
    @Req() req: RequestWithOrgId,
    @Res() res: Response,
  ): Promise<void> {
    req.organizationId = organizationId;

    try {
      const options = await this.samlService.buildSamlOptions(organizationId);
      const saml = new SamlLib.SAML(options);

      const body = req.body as { SAMLResponse?: string; RelayState?: string };
      const { profile } = await saml.validatePostResponseAsync(body);

      const user = await this.samlService.validateAssertion(
        profile as Parameters<typeof this.samlService.validateAssertion>[0],
        organizationId,
      );

      this.logger.log(`SAML login success: ${user.email} for org: ${organizationId}`);

      // In a real app: create session / issue JWT here
      res.status(HttpStatus.OK).json({
        message: 'SAML authentication successful',
        user,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error('SAML callback error', { organizationId, error: message });
      res.status(HttpStatus.UNAUTHORIZED).json({ message });
    }
  }

  @Get('saml/:organizationId/metadata')
  @ApiOperation({ summary: 'Returns SP metadata XML for IdP registration' })
  @ApiParam({ name: 'organizationId', description: 'Organization identifier' })
  async samlMetadata(
    @Param('organizationId') organizationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const options = await this.samlService.buildSamlOptions(organizationId);
    const saml = new SamlLib.SAML(options);
    const metadata = saml.generateServiceProviderMetadata(null, null);
    res.header('Content-Type', 'application/xml');
    res.send(metadata);
  }

  // ─── OIDC Endpoints ────────────────────────────────────────────────────────

  @Get('oidc/:organizationId/login')
  @ApiOperation({ summary: 'Initiate OIDC login — redirects to IdP' })
  @ApiParam({ name: 'organizationId', description: 'Organization identifier' })
  async oidcLogin(
    @Param('organizationId') organizationId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const state = Math.random().toString(36).substring(2, 18);
    // Store state in session for CSRF validation (session middleware required)
    (req.session as Record<string, unknown>)['oidcState'] = state;
    (req.session as Record<string, unknown>)['oidcOrganizationId'] = organizationId;

    const url = await this.oidcService.getAuthorizationUrl(organizationId, state);
    res.redirect(url);
  }

  @Get('oidc/:organizationId/callback')
  @ApiOperation({ summary: 'OIDC authorization code callback' })
  @ApiParam({ name: 'organizationId', description: 'Organization identifier' })
  @ApiResponse({ status: 200, type: SsoUserDto })
  async oidcCallback(
    @Param('organizationId') organizationId: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const storedState = (req.session as Record<string, unknown>)['oidcState'] as string;
      if (!storedState || storedState !== query['state']) {
        res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid OIDC state parameter' });
        return;
      }

      const user = await this.oidcService.handleCallback(organizationId, query, storedState);

      this.logger.log(`OIDC login success: ${user.email} for org: ${organizationId}`);

      // In a real app: create session / issue JWT here
      res.status(HttpStatus.OK).json({
        message: 'OIDC authentication successful',
        user,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error('OIDC callback error', { organizationId, error: message });
      res.status(HttpStatus.UNAUTHORIZED).json({ message });
    }
  }

  // ─── Provider Management Endpoints (Admin-protected) ──────────────────────

  @Post(':organizationId/saml/configure')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configure SAML provider for an organization' })
  async configureSaml(
    @Param('organizationId') organizationId: string,
    @Body() config: SamlConfigDto,
  ) {
    const provider = await this.samlService.configureProvider(organizationId, config);
    return { message: 'SAML provider configured successfully', providerId: provider.id };
  }

  @Put(':organizationId/saml/configure')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update SAML provider configuration' })
  async updateSaml(
    @Param('organizationId') organizationId: string,
    @Body() config: Partial<SamlConfigDto>,
  ) {
    const provider = await this.samlService.updateProvider(organizationId, config);
    return { message: 'SAML provider updated successfully', providerId: provider.id };
  }

  @Post(':organizationId/oidc/configure')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configure OIDC provider for an organization' })
  async configureOidc(
    @Param('organizationId') organizationId: string,
    @Body() config: OidcConfigDto,
  ) {
    const provider = await this.oidcService.configureProvider(organizationId, config);
    return { message: 'OIDC provider configured successfully', providerId: provider.id };
  }

  @Put(':organizationId/oidc/configure')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update OIDC provider configuration' })
  async updateOidc(
    @Param('organizationId') organizationId: string,
    @Body() config: Partial<OidcConfigDto>,
  ) {
    const provider = await this.oidcService.updateProvider(organizationId, config);
    return { message: 'OIDC provider updated successfully', providerId: provider.id };
  }
}
