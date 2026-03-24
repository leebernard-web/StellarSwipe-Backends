import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SamlService } from './saml.service';
import { SsoProvider, SsoProtocol } from './entities/sso-provider.entity';
import { SsoMapping } from './entities/sso-mapping.entity';
import { SamlConfigDto } from './dto/saml-config.dto';

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIICsDCCAhmgAwIBAgIJALwzrJEou8DkMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV
BAYTAlVTMRMwEQYDVQQIEwpTb21lLVN0YXRlMSEwHwYDVQQKExhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTIwMTE3MTIwNTQzWhcNMjIwMTE0MTIwNTQzWjBF
-----END CERTIFICATE-----`;

const mockProvider: SsoProvider = {
  id: 'provider-uuid',
  organizationId: 'org-123',
  protocol: SsoProtocol.SAML,
  providerName: 'Test SAML IdP',
  isActive: true,
  entryPoint: 'https://idp.example.com/sso/saml',
  issuer: 'https://idp.example.com',
  cert: VALID_CERT,
  callbackUrl: 'https://app.example.com/auth/sso/saml/callback',
  signatureAlgorithm: 'sha256',
  identifierFormat: undefined,
  wantAuthnResponseSigned: true,
  wantAssertionsSigned: true,
  privateKey: undefined,
  clientId: undefined,
  clientSecret: undefined,
  discoveryUrl: undefined,
  authorizationUrl: undefined,
  tokenUrl: undefined,
  userInfoUrl: undefined,
  jwksUri: undefined,
  scope: undefined,
  responseType: undefined,
  mapping: {
    id: 'mapping-uuid',
    providerId: 'provider-uuid',
    emailField: 'email',
    firstNameField: 'firstName',
    lastNameField: 'lastName',
    usernameField: undefined,
    displayNameField: undefined,
    rolesField: undefined,
    groupsField: undefined,
    roleMapping: undefined,
    customMappings: undefined,
    autoProvisionUsers: true,
    updateOnLogin: true,
    provider: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SamlService', () => {
  let service: SamlService;
  let providerRepo: jest.Mocked<Repository<SsoProvider>>;
  let mappingRepo: jest.Mocked<Repository<SsoMapping>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamlService,
        {
          provide: getRepositoryToken(SsoProvider),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SsoMapping),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SamlService>(SamlService);
    providerRepo = module.get(getRepositoryToken(SsoProvider));
    mappingRepo = module.get(getRepositoryToken(SsoMapping));
  });

  afterEach(() => jest.clearAllMocks());

  // ── getProviderConfig ──────────────────────────────────────────────────────

  describe('getProviderConfig', () => {
    it('should return a provider when found', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      const result = await service.getProviderConfig('org-123');
      expect(result).toEqual(mockProvider);
      expect(providerRepo.findOne).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', protocol: SsoProtocol.SAML, isActive: true },
        relations: ['mapping'],
      });
    });

    it('should throw NotFoundException when provider does not exist', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(service.getProviderConfig('org-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── validateAssertion ──────────────────────────────────────────────────────

  describe('validateAssertion', () => {
    it('should map a SAML profile to SsoUserDto', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);

      const profile = {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        nameID: 'john@example.com',
        nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        issuer: 'https://idp.example.com',
      } as any;

      const result = await service.validateAssertion(profile, 'org-123');

      expect(result.email).toBe('john@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.protocol).toBe('saml');
      expect(result.providerId).toBe('provider-uuid');
    });

    it('should lowercase and trim the email', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);

      const profile = {
        email: '  JOHN@EXAMPLE.COM  ',
        nameID: 'john@example.com',
        issuer: 'https://idp.example.com',
      } as any;

      const result = await service.validateAssertion(profile, 'org-123');
      expect(result.email).toBe('john@example.com');
    });

    it('should throw when email attribute is missing from profile', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);

      const profile = { nameID: 'some-id', issuer: 'https://idp.example.com' } as any;

      await expect(service.validateAssertion(profile, 'org-123')).rejects.toThrow(
        /email/i,
      );
    });
  });

  // ── configureProvider ──────────────────────────────────────────────────────

  describe('configureProvider', () => {
    const config: SamlConfigDto = {
      entryPoint: 'https://idp.example.com/sso/saml',
      issuer: 'https://idp.example.com',
      cert: VALID_CERT,
      callbackUrl: 'https://app.example.com/auth/sso/saml/callback',
    };

    it('should create and return a new SAML provider', async () => {
      providerRepo.findOne
        .mockResolvedValueOnce(null)            // initial conflict check
        .mockResolvedValueOnce(mockProvider);   // final fetch after save

      providerRepo.create.mockReturnValue(mockProvider);
      providerRepo.save.mockResolvedValue(mockProvider);
      mappingRepo.create.mockReturnValue(mockProvider.mapping);
      mappingRepo.save.mockResolvedValue(mockProvider.mapping);

      const result = await service.configureProvider('org-123', config);
      expect(result).toEqual(mockProvider);
      expect(providerRepo.save).toHaveBeenCalled();
      expect(mappingRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if provider already exists', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      await expect(service.configureProvider('org-123', config)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException for invalid certificate', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.configureProvider('org-123', { ...config, cert: 'not-a-cert' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── buildSamlOptions ───────────────────────────────────────────────────────

  describe('buildSamlOptions', () => {
    it('should return correctly structured passport-saml options', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      const options = await service.buildSamlOptions('org-123');

      expect(options).toMatchObject({
        entryPoint: mockProvider.entryPoint,
        issuer: mockProvider.issuer,
        cert: mockProvider.cert,
        callbackUrl: mockProvider.callbackUrl,
        signatureAlgorithm: 'sha256',
        wantAuthnResponseSigned: true,
        wantAssertionsSigned: true,
      });
    });
  });
});
