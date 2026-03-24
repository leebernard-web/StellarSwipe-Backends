export enum SubmissionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export interface SubmissionResult {
  submissionId: string;
  status: SubmissionStatus;
  acknowledgedAt?: Date;
  rejectionReason?: string;
  referenceNumber?: string;
}

export interface SubmissionApi {
  submit(reportId: string, content: string, format: string): Promise<SubmissionResult>;
  checkStatus(submissionId: string): Promise<SubmissionResult>;
}
