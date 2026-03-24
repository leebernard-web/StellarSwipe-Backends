import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUrl,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AttributeMappingDto {
  @ApiProperty({ example: 'email' })
  @IsString()
  @IsNotEmpty()
  emailField: string;

  @ApiPropertyOptional({ example: 'firstName' })
  @IsOptional()
  @IsString()
  firstNameField?: string;

  @ApiPropertyOptional({ example: 'lastName' })
  @IsOptional()
  @IsString()
  lastNameField?: string;

  @ApiPropertyOptional({ example: 'username' })
  @IsOptional()
  @IsString()
  usernameField?: string;

  @ApiPropertyOptional({ example: 'displayName' })
  @IsOptional()
  @IsString()
  displayNameField?: string;
}

export class SamlConfigDto {
  @ApiProperty({ example: 'https://idp.example.com/sso/saml' })
  @IsUrl()
  @IsNotEmpty()
  entryPoint: string;

  @ApiProperty({ example: 'https://idp.example.com/issuer' })
  @IsString()
  @IsNotEmpty()
  issuer: string;

  @ApiProperty({ description: 'PEM-encoded X.509 certificate from IdP' })
  @IsString()
  @IsNotEmpty()
  cert: string;

  @ApiProperty({ example: 'https://app.example.com/auth/sso/saml/callback' })
  @IsUrl()
  @IsNotEmpty()
  callbackUrl: string;

  @ApiPropertyOptional({ example: 'Corporate SSO' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ enum: ['sha1', 'sha256', 'sha512'], default: 'sha256' })
  @IsOptional()
  @IsEnum(['sha1', 'sha256', 'sha512'])
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';

  @ApiPropertyOptional({
    example: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  })
  @IsOptional()
  @IsString()
  identifierFormat?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  wantAuthnResponseSigned?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  wantAssertionsSigned?: boolean;

  @ApiPropertyOptional({ description: 'PEM-encoded private key for signing requests' })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AttributeMappingDto)
  attributeMapping?: AttributeMappingDto;
}
