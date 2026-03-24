import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

import { SsoController } from './sso.controller';
import { SamlService } from './saml.service';
import { OidcService } from './oidc.service';
import { SamlStrategy } from './strategies/saml.strategy';
import { OidcStrategy } from './strategies/oidc.strategy';
import { SsoProvider } from './entities/sso-provider.entity';
import { SsoMapping } from './entities/sso-mapping.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'saml' }),
    TypeOrmModule.forFeature([SsoProvider, SsoMapping]),
  ],
  controllers: [SsoController],
  providers: [SamlService, OidcService, SamlStrategy, OidcStrategy],
  exports: [SamlService, OidcService],
})
export class SsoModule {}
