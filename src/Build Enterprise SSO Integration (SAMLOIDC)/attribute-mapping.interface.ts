export interface AttributeMapping {
  id: string;
  providerId: string;

  // Standard user fields
  emailField: string;
  firstNameField?: string;
  lastNameField?: string;
  usernameField?: string;
  displayNameField?: string;

  // Role/group mapping
  rolesField?: string;
  groupsField?: string;
  roleMapping?: Record<string, string[]>; // idp_role -> local_roles[]

  // Custom attribute mappings
  customMappings?: CustomAttributeMapping[];
}

export interface CustomAttributeMapping {
  sourceAttribute: string;  // Attribute name from IdP
  targetField: string;      // Local user field to map to
  transform?: 'lowercase' | 'uppercase' | 'trim' | 'none';
  defaultValue?: string;
}

export interface MappedUserAttributes {
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  displayName?: string;
  roles?: string[];
  groups?: string[];
  rawAttributes?: Record<string, unknown>;
}
