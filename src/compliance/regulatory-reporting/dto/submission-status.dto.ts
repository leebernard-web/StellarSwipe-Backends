import { SubmissionStatus } from '../interfaces/submission-api.interface';

export class SubmissionStatusDto {
  reportId!: string;
  submissionId?: string;
  status!: SubmissionStatus;
  referenceNumber?: string;
  submittedAt?: Date;
  acknowledgedAt?: Date;
  rejectionReason?: string;
  retryCount!: number;
}
