import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SubmissionStatus } from '../interfaces/submission-api.interface';

@Entity('submission_records')
@Index(['reportId'])
export class SubmissionRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id' })
  @Index()
  reportId!: string;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.PENDING })
  @Index()
  status!: SubmissionStatus;

  @Column({ name: 'submission_id', nullable: true })
  submissionId?: string;

  @Column({ name: 'reference_number', nullable: true })
  referenceNumber?: string;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt?: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
