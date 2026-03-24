import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReportType, ReportFormat } from '../interfaces/report-format.interface';

@Entity('report_templates')
export class ReportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ReportType, unique: true })
  type!: ReportType;

  @Column({ type: 'enum', enum: ReportFormat })
  format!: ReportFormat;

  @Column({ type: 'text' })
  schema!: string;

  @Column({ name: 'version', length: 20 })
  version!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
