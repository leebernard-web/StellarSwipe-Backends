import { Logger } from '@nestjs/common';
import { AttributeMapping, MappedUserAttributes } from '../interfaces/attribute-mapping.interface';

const logger = new Logger('SamlParser');

/**
 * Extracts a single string value from a SAML attribute (which may be an array).
 */
function extractSingleValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return String(value);
}

/**
 * Extracts an array of string values from a SAML attribute.
 */
function extractArrayValue(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return [value];
  return [String(value)];
}

/**
 * Applies a string transformation to a value.
 */
function applyTransform(
  value: string,
  transform?: 'lowercase' | 'uppercase' | 'trim' | 'none',
): string {
  switch (transform) {
    case 'lowercase':
      return value.toLowerCase();
    case 'uppercase':
      return value.toUpperCase();
    case 'trim':
      return value.trim();
    default:
      return value;
  }
}

/**
 * Parses raw SAML profile attributes into a normalized user object
 * using the provided attribute mapping configuration.
 */
export function parseSamlAttributes(
  profile: Record<string, unknown>,
  mapping: AttributeMapping,
): MappedUserAttributes {
  const attributes: Record<string, unknown> = {
    ...profile,
    ...(profile['attributes'] as Record<string, unknown> || {}),
  };

  // Extract email (required)
  const email = extractSingleValue(attributes[mapping.emailField]);
  if (!email) {
    logger.warn(`SAML profile missing email field: "${mapping.emailField}"`, {
      availableKeys: Object.keys(attributes),
    });
    throw new Error(`SAML assertion missing required email attribute: "${mapping.emailField}"`);
  }

  const result: MappedUserAttributes = {
    email: email.toLowerCase().trim(),
    rawAttributes: attributes as Record<string, unknown>,
  };

  // Optional standard fields
  if (mapping.firstNameField) {
    result.firstName = extractSingleValue(attributes[mapping.firstNameField]);
  }
  if (mapping.lastNameField) {
    result.lastName = extractSingleValue(attributes[mapping.lastNameField]);
  }
  if (mapping.usernameField) {
    result.username = extractSingleValue(attributes[mapping.usernameField]);
  }
  if (mapping.displayNameField) {
    result.displayName = extractSingleValue(attributes[mapping.displayNameField]);
  }

  // Role extraction with optional mapping
  if (mapping.rolesField) {
    const rawRoles = extractArrayValue(attributes[mapping.rolesField]);
    if (mapping.roleMapping && Object.keys(mapping.roleMapping).length > 0) {
      const mappedRoles = new Set<string>();
      for (const rawRole of rawRoles) {
        const localRoles = mapping.roleMapping[rawRole] || mapping.roleMapping['*'];
        if (localRoles) {
          localRoles.forEach((r) => mappedRoles.add(r));
        } else {
          mappedRoles.add(rawRole); // Pass through unmapped roles
        }
      }
      result.roles = Array.from(mappedRoles);
    } else {
      result.roles = rawRoles;
    }
  }

  // Group extraction
  if (mapping.groupsField) {
    result.groups = extractArrayValue(attributes[mapping.groupsField]);
  }

  // Custom attribute mappings
  if (mapping.customMappings && mapping.customMappings.length > 0) {
    const customData: Record<string, string> = {};
    for (const custom of mapping.customMappings) {
      const rawValue = extractSingleValue(attributes[custom.sourceAttribute]);
      const finalValue = rawValue
        ? applyTransform(rawValue, custom.transform)
        : custom.defaultValue;
      if (finalValue !== undefined) {
        customData[custom.targetField] = finalValue;
      }
    }
    result.rawAttributes = { ...result.rawAttributes, _custom: customData };
  }

  return result;
}

/**
 * Validates a SAML certificate string (basic PEM format check).
 */
export function validateSamlCert(cert: string): boolean {
  const normalized = cert.trim();
  return (
    normalized.includes('-----BEGIN CERTIFICATE-----') &&
    normalized.includes('-----END CERTIFICATE-----')
  );
}

/**
 * Strips PEM headers from a certificate for use with passport-saml.
 */
export function stripPemHeaders(cert: string): string {
  return cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}
