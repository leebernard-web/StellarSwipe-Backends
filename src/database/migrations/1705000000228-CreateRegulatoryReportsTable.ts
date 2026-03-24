import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRegulatoryReportsTable1705000000228 implements MigrationInterface {
  name = 'CreateRegulatoryReportsTable1705000000228';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "report_type_enum" AS ENUM ('FINRA', 'SEC', 'MIFID2')`);
    await queryRunner.query(`CREATE TYPE "report_format_enum" AS ENUM ('xml', 'json', 'csv')`);
    await queryRunner.query(`CREATE TYPE "report_period_enum" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly')`);
    await queryRunner.query(`CREATE TYPE "regulatory_report_status_enum" AS ENUM ('draft', 'generated', 'validated', 'submitted', 'accepted', 'rejected', 'failed')`);
    await queryRunner.query(`CREATE TYPE "submission_status_enum" AS ENUM ('pending', 'submitted', 'accepted', 'rejected', 'failed')`);

    await queryRunner.createTable(
      new Table({
        name: 'regulatory_reports',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'type', type: 'enum', enumName: 'report_type_enum' },
          { name: 'format', type: 'enum', enumName: 'report_format_enum' },
          { name: 'period', type: 'enum', enumName: 'report_period_enum' },
          { name: 'period_start', type: 'timestamp' },
          { name: 'period_end', type: 'timestamp' },
          { name: 'status', type: 'enum', enumName: 'regulatory_report_status_enum', default: "'draft'" },
          { name: 'record_count', type: 'int', default: 0 },
          { name: 'content', type: 'text', isNullable: true },
          { name: 'checksum', type: 'varchar', length: '64', isNullable: true },
          { name: 'validation_errors', type: 'jsonb', isNullable: true },
          { name: 'generated_by', type: 'varchar', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'submission_records',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'report_id', type: 'uuid' },
          { name: 'status', type: 'enum', enumName: 'submission_status_enum', default: "'pending'" },
          { name: 'submission_id', type: 'varchar', isNullable: true },
          { name: 'reference_number', type: 'varchar', isNullable: true },
          { name: 'submitted_at', type: 'timestamp', isNullable: true },
          { name: 'acknowledged_at', type: 'timestamp', isNullable: true },
          { name: 'rejection_reason', type: 'text', isNullable: true },
          { name: 'retry_count', type: 'int', default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'report_templates',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'type', type: 'enum', enumName: 'report_type_enum', isUnique: true },
          { name: 'format', type: 'enum', enumName: 'report_format_enum' },
          { name: 'schema', type: 'text' },
          { name: 'version', type: 'varchar', length: '20' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.query(`CREATE INDEX "IDX_regulatory_reports_type_period" ON "regulatory_reports" ("type", "period_start")`);
    await queryRunner.query(`CREATE INDEX "IDX_regulatory_reports_status" ON "regulatory_reports" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_submission_records_report_id" ON "submission_records" ("report_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_submission_records_status" ON "submission_records" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('report_templates');
    await queryRunner.dropTable('submission_records');
    await queryRunner.dropTable('regulatory_reports');
    await queryRunner.query(`DROP TYPE "submission_status_enum"`);
    await queryRunner.query(`DROP TYPE "regulatory_report_status_enum"`);
    await queryRunner.query(`DROP TYPE "report_period_enum"`);
    await queryRunner.query(`DROP TYPE "report_format_enum"`);
    await queryRunner.query(`DROP TYPE "report_type_enum"`);
  }
}
