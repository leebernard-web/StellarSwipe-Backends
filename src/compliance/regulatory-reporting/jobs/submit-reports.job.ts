import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportingService } from '../reporting.service';
import { RegulatoryReport, RegulatoryReportStatus } from '../entities/regulatory-report.entity';

export const SUBMIT_REPORTS_QUEUE = 'submit-reports';

@Processor(SUBMIT_REPORTS_QUEUE)
export class SubmitReportsJob {
  private readonly logger = new Logger(SubmitReportsJob.name);

  constructor(
    private readonly reportingService: ReportingService,
    @InjectRepository(RegulatoryReport)
    private readonly reportRepo: Repository<RegulatoryReport>,
  ) {}

  @Process('submit-validated')
  async handleSubmitValidated(): Promise<{ submitted: number; errors: number }> {
    const reports = await this.reportRepo.find({
      where: { status: RegulatoryReportStatus.VALIDATED },
    });

    let submitted = 0;
    let errors = 0;

    for (const report of reports) {
      try {
        await this.reportingService.submit(report.id);
        submitted++;
      } catch (err) {
        this.logger.error(`Failed to submit report ${report.id}: ${(err as Error).message}`);
        errors++;
      }
    }

    this.logger.log(`Submission run: ${submitted} submitted, ${errors} errors`);
    return { submitted, errors };
  }

  @Process('submit-single')
  async handleSubmitSingle(job: Job<{ reportId: string }>) {
    return this.reportingService.submit(job.data.reportId);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} (${job.name}) failed: ${error.message}`);
  }
}
