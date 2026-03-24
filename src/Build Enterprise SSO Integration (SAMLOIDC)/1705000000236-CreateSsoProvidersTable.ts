import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSsoProvidersTable1705000000236 implements MigrationInterface {
  name = 'CreateSsoProvidersTable1705000000236';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "sso_providers_protocol_enum" AS ENUM ('saml', 'oidc')
    `);

    // ── sso_providers ──────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'sso_providers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'organization_id', type: 'varchar', isNullable: false },
          {
            name: 'protocol',
            type: 'enum',
            enum: ['saml', 'oidc'],
            isNullable: false,
          },
          { name: 'provider_name', type: 'varchar', isNullable: false },
          { name: 'is_active', type: 'boolean', default: true },

          // SAML fields
          { name: 'entry_point', type: 'varchar', isNullable: true },
          { name: 'issuer', type: 'varchar', isNullable: true },
          { name: 'cert', type: 'text', isNullable: true },
          { name: 'signature_algorithm', type: 'varchar', isNullable: true },
          { name: 'identifier_format', type: 'varchar', isNullable: true },
          { name: 'want_authn_response_signed', type: 'boolean', default: true },
          { name: 'want_assertions_signed', type: 'boolean', default: true },
          { name: 'private_key', type: 'text', isNullable: true },

          // OIDC fields
          { name: 'client_id', type: 'varchar', isNullable: true },
          { name: 'client_secret', type: 'varchar', isNullable: true },
          { name: 'discovery_url', type: 'varchar', isNullable: true },
          { name: 'authorization_url', type: 'varchar', isNullable: true },
          { name: 'token_url', type: 'varchar', isNullable: true },
          { name: 'user_info_url', type: 'varchar', isNullable: true },
          { name: 'jwks_uri', type: 'varchar', isNullable: true },
          { name: 'callback_url', type: 'varchar', isNullable: false },
          { name: 'scope', type: 'text', isNullable: true },
          { name: 'response_type', type: 'varchar', isNullable: true },

          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'sso_providers',
      new TableIndex({
        name: 'IDX_sso_providers_organization_id',
        columnNames: ['organization_id'],
      }),
    );

    await queryRunner.createIndex(
      'sso_providers',
      new TableIndex({
        name: 'UQ_sso_providers_org_protocol',
        columnNames: ['organization_id', 'protocol'],
        isUnique: true,
      }),
    );

    // ── sso_mappings ───────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'sso_mappings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'provider_id', type: 'uuid', isNullable: false },
          { name: 'email_field', type: 'varchar', default: "'email'" },
          { name: 'first_name_field', type: 'varchar', isNullable: true },
          { name: 'last_name_field', type: 'varchar', isNullable: true },
          { name: 'username_field', type: 'varchar', isNullable: true },
          { name: 'display_name_field', type: 'varchar', isNullable: true },
          { name: 'roles_field', type: 'varchar', isNullable: true },
          { name: 'groups_field', type: 'varchar', isNullable: true },
          { name: 'role_mapping', type: 'jsonb', isNullable: true },
          { name: 'custom_mappings', type: 'jsonb', isNullable: true },
          { name: 'auto_provision_users', type: 'boolean', default: true },
          { name: 'update_on_login', type: 'boolean', default: true },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'sso_mappings',
      new TableForeignKey({
        name: 'FK_sso_mappings_provider',
        columnNames: ['provider_id'],
        referencedTableName: 'sso_providers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'sso_mappings',
      new TableIndex({
        name: 'UQ_sso_mappings_provider_id',
        columnNames: ['provider_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('sso_mappings', 'FK_sso_mappings_provider');
    await queryRunner.dropTable('sso_mappings');
    await queryRunner.dropIndex('sso_providers', 'UQ_sso_providers_org_protocol');
    await queryRunner.dropIndex('sso_providers', 'IDX_sso_providers_organization_id');
    await queryRunner.dropTable('sso_providers');
    await queryRunner.query(`DROP TYPE IF EXISTS "sso_providers_protocol_enum"`);
  }
}
