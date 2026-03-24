import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { MappedUserAttributes } from '../interfaces/attribute-mapping.interface';
import { AttributeMapping } from '../interfaces/attribute-mapping.interface';

const logger = new Logger('JwtValidator');

// Cache JWKS clients per URI to avoid recreating on every request
const jwksClientCache = new Map<string, jwksClient.JwksClient>();

function getJwksClient(jwksUri: string): jwksClient.JwksClient {
  if (!jwksClientCache.has(jwksUri)) {
    const client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    });
    jwksClientCache.set(jwksUri, client);
  }
  return jwksClientCache.get(jwksUri)!;
}

/**
 * Fetches the signing key from a JWKS endpoint for a given JWT header.
 */
async function getSigningKey(jwksUri: string, kid?: string): Promise<string> {
  const client = getJwksClient(jwksUri);

  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) {
        logger.error('Failed to retrieve JWKS signing key', { jwksUri, kid, error: err.message });
        return reject(new Error(`Failed to retrieve JWKS signing key: ${err.message}`));
      }
      const signingKey = key?.getPublicKey();
      if (!signingKey) {
        return reject(new Error('Signing key is undefined'));
      }
      resolve(signingKey);
    });
  });
}

export interface JwtValidationOptions {
  jwksUri?: string;
  secret?: string;
  issuer?: string;
  audience?: string | string[];
  algorithms?: jwt.Algorithm[];
}

export interface ValidatedJwtPayload {
  sub?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Validates an OIDC ID token or access token.
 * Supports both JWKS-based validation (RS256) and shared-secret (HS256).
 */
export async function validateJwt(
  token: string,
  options: JwtValidationOptions,
): Promise<ValidatedJwtPayload> {
  const algorithms = options.algorithms || ['RS256'];

  if (options.jwksUri) {
    // JWKS-based validation (most OIDC providers)
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Failed to decode JWT header');
    }

    const kid = (decoded.header as jwt.JwtHeader).kid;
    const signingKey = await getSigningKey(options.jwksUri, kid);

    try {
      const payload = jwt.verify(token, signingKey, {
        algorithms,
        issuer: options.issuer,
        audience: options.audience,
      }) as ValidatedJwtPayload;
      return payload;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.warn('JWT verification failed', { error: errorMessage });
      throw new Error(`JWT validation failed: ${errorMessage}`);
    }
  } else if (options.secret) {
    // Symmetric secret validation (HS256)
    try {
      const payload = jwt.verify(token, options.secret, {
        algorithms: ['HS256'],
        issuer: options.issuer,
        audience: options.audience,
      }) as ValidatedJwtPayload;
      return payload;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`JWT validation failed: ${errorMessage}`);
    }
  } else {
    throw new Error('Either jwksUri or secret must be provided for JWT validation');
  }
}

/**
 * Maps a validated OIDC token/userinfo payload to normalized user attributes.
 */
export function mapOidcClaims(
  claims: Record<string, unknown>,
  mapping: AttributeMapping,
): MappedUserAttributes {
  function extract(field?: string): string | undefined {
    if (!field) return undefined;
    const val = claims[field];
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && val.length > 0) return String(val[0]);
    return undefined;
  }

  const email = extract(mapping.emailField);
  if (!email) {
    throw new Error(`OIDC claims missing required email field: "${mapping.emailField}"`);
  }

  const result: MappedUserAttributes = {
    email: email.toLowerCase().trim(),
    rawAttributes: claims,
  };

  result.firstName = extract(mapping.firstNameField);
  result.lastName = extract(mapping.lastNameField);
  result.username = extract(mapping.usernameField);
  result.displayName = extract(mapping.displayNameField);

  // Roles
  if (mapping.rolesField) {
    const rawRoles = claims[mapping.rolesField];
    const roleList: string[] = Array.isArray(rawRoles)
      ? rawRoles.map(String)
      : rawRoles
      ? [String(rawRoles)]
      : [];

    if (mapping.roleMapping) {
      const mapped = new Set<string>();
      for (const r of roleList) {
        const local = mapping.roleMapping[r] || mapping.roleMapping['*'];
        if (local) local.forEach((x) => mapped.add(x));
        else mapped.add(r);
      }
      result.roles = Array.from(mapped);
    } else {
      result.roles = roleList;
    }
  }

  // Groups
  if (mapping.groupsField) {
    const rawGroups = claims[mapping.groupsField];
    result.groups = Array.isArray(rawGroups) ? rawGroups.map(String) : [];
  }

  return result;
}
