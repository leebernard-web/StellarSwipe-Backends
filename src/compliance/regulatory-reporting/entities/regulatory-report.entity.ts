import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ReportType, ReportFormat, ReportPeriod } from '../interfaces/report-format.interface';

export enum RegulatoryReportStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  VALIDATED = 'validated',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

@Entity('regulatory_reports')
@Index(['type', 'periodStart'])
export class RegulatoryReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ReportType })
  @Index()
  type!: ReportType;

  @Column({ type: 'enum', enum: ReportFormat })
  format!: ReportFormat;

  @Column({ type: 'enum', enum: ReportPeriod })
  period!: ReportPeriod;

  @Column({ name: 'period_start', type: 'timestamp' })
  @Index()
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd!: Date;

  @Column({ type: 'enum', enum: RegulatoryReportStatus, default: RegulatoryReportStatus.DRAFT })
  @Index()
  status!: RegulatoryReportStatus;

  @Column({ name: 'record_count', type: 'int', default: 0 })
  recordCount!: number;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ length: 64, nullable: true })
  checksum?: string;

  @Column({ name: 'validation_errors', type: 'jsonb', nullable: true })
  validationErrors?: string[];

  @Column({ name: 'generated_by', nullable: true })
  generatedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
