import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OidcAttributeMappingDto {
  @ApiProperty({ example: 'email' })
  @IsString()
  @IsNotEmpty()
  emailField: string;

  @ApiPropertyOptional({ example: 'given_name' })
  @IsOptional()
  @IsString()
  firstNameField?: string;

  @ApiPropertyOptional({ example: 'family_name' })
  @IsOptional()
  @IsString()
  lastNameField?: string;

  @ApiPropertyOptional({ example: 'preferred_username' })
  @IsOptional()
  @IsString()
  usernameField?: string;

  @ApiPropertyOptional({ example: 'name' })
  @IsOptional()
  @IsString()
  displayNameField?: string;
}

export class OidcConfigDto {
  @ApiProperty({ example: 'my-client-id' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: 'my-client-secret' })
  @IsString()
  @IsNotEmpty()
  clientSecret: string;

  @ApiProperty({ example: 'https://app.example.com/auth/sso/oidc/callback' })
  @IsUrl()
  @IsNotEmpty()
  callbackUrl: string;

  @ApiPropertyOptional({
    example: 'https://accounts.google.com/.well-known/openid-configuration',
    description: 'OIDC discovery endpoint (preferred over manual URLs)',
  })
  @IsOptional()
  @IsUrl()
  discoveryUrl?: string;

  @ApiPropertyOptional({ example: 'https://idp.example.com/oauth2/authorize' })
  @IsOptional()
  @IsUrl()
  authorizationUrl?: string;

  @ApiPropertyOptional({ example: 'https://idp.example.com/oauth2/token' })
  @IsOptional()
  @IsUrl()
  tokenUrl?: string;

  @ApiPropertyOptional({ example: 'https://idp.example.com/oauth2/userinfo' })
  @IsOptional()
  @IsUrl()
  userInfoUrl?: string;

  @ApiPropertyOptional({ example: 'https://idp.example.com/.well-known/jwks.json' })
  @IsOptional()
  @IsUrl()
  jwksUri?: string;

  @ApiProperty({ example: ['openid', 'email', 'profile'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scope: string[];

  @ApiPropertyOptional({ example: 'code', default: 'code' })
  @IsOptional()
  @IsString()
  responseType?: string;

  @ApiPropertyOptional({ example: 'Corporate OIDC' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => OidcAttributeMappingDto)
  attributeMapping?: OidcAttributeMappingDto;
}
