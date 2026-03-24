export interface SsoConfig {
  id: string;
  organizationId: string;
  protocol: 'saml' | 'oidc';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SamlSsoConfig extends SsoConfig {
  protocol: 'saml';
  entryPoint: string;
  issuer: string;
  cert: string;
  callbackUrl: string;
  signatureAlgorithm?: 'sha1' | 'sha256' | 'sha512';
  identifierFormat?: string;
  wantAuthnResponseSigned?: boolean;
  wantAssertionsSigned?: boolean;
  privateKey?: string;
  decryptionPvk?: string;
}

export interface OidcSsoConfig extends SsoConfig {
  protocol: 'oidc';
  clientId: string;
  clientSecret: string;
  discoveryUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUri?: string;
  callbackUrl: string;
  scope: string[];
  responseType: string;
}
