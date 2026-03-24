import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateDedicatedInstancesTable1705000000235 implements MigrationInterface {
  name = 'CreateDedicatedInstancesTable1705000000235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "instance_type_enum" AS ENUM ('standard', 'performance', 'enterprise')`);
    await queryRunner.query(`CREATE TYPE "instance_status_enum" AS ENUM ('provisioning', 'active', 'scaling', 'maintenance', 'suspended', 'terminating', 'terminated')`);
    await queryRunner.query(`CREATE TYPE "resource_type_enum" AS ENUM ('cpu', 'memory', 'storage', 'bandwidth')`);

    await queryRunner.createTable(
      new Table({
        name: 'dedicated_instances',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'varchar' },
          { name: 'instance_name', type: 'varchar', length: '255' },
          { name: 'type', type: 'enum', enumName: 'instance_type_enum' },
          { name: 'status', type: 'enum', enumName: 'instance_status_enum', default: "'provisioning'" },
          { name: 'deployment_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'service_name', type: 'varchar', length: '255', isNullable: true },
          { name: 'ingress_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'dedicated_ip', type: 'varchar', length: '45', isNullable: true },
          { name: 'isolation_level', type: 'varchar', length: '50', default: "'pod'" },
          { name: 'namespace', type: 'varchar', length: '255' },
          { name: 'replica_count', type: 'int', default: 1 },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'provisioned_at', type: 'timestamp', isNullable: true },
          { name: 'terminated_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'resource_allocations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'instance_id', type: 'uuid' },
          { name: 'resource_type', type: 'enum', enumName: 'resource_type_enum' },
          { name: 'allocated_amount', type: 'decimal', precision: 12, scale: 4 },
          { name: 'used_amount', type: 'decimal', precision: 12, scale: 4, default: 0 },
          { name: 'unit', type: 'varchar', length: '20' },
          { name: 'limit_amount', type: 'decimal', precision: 12, scale: 4, isNullable: true },
          { name: 'threshold_percent', type: 'int', default: 80 },
          { name: 'metrics', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'instance_configs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'instance_id', type: 'uuid' },
          { name: 'config_key', type: 'varchar', length: '255' },
          { name: 'config_value', type: 'text' },
          { name: 'is_secret', type: 'boolean', default: false },
          { name: 'is_encrypted', type: 'boolean', default: false },
          { name: 'description', type: 'varchar', length: '500', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.query(`CREATE INDEX "IDX_dedicated_instances_user_status" ON "dedicated_instances" ("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_dedicated_instances_user_id" ON "dedicated_instances" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_dedicated_instances_type" ON "dedicated_instances" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_dedicated_instances_status" ON "dedicated_instances" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_resource_allocations_instance_type" ON "resource_allocations" ("instance_id", "resource_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_resource_allocations_instance_id" ON "resource_allocations" ("instance_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_instance_configs_instance_id" ON "instance_configs" ("instance_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_instance_configs_instance_id"`);
    await queryRunner.query(`DROP INDEX "IDX_resource_allocations_instance_id"`);
    await queryRunner.query(`DROP INDEX "IDX_resource_allocations_instance_type"`);
    await queryRunner.query(`DROP INDEX "IDX_dedicated_instances_status"`);
    await queryRunner.query(`DROP INDEX "IDX_dedicated_instances_type"`);
    await queryRunner.query(`DROP INDEX "IDX_dedicated_instances_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_dedicated_instances_user_status"`);

    await queryRunner.dropTable('instance_configs');
    await queryRunner.dropTable('resource_allocations');
    await queryRunner.dropTable('dedicated_instances');

    await queryRunner.query(`DROP TYPE "resource_type_enum"`);
    await queryRunner.query(`DROP TYPE "instance_status_enum"`);
    await queryRunner.query(`DROP TYPE "instance_type_enum"`);
  }
}
