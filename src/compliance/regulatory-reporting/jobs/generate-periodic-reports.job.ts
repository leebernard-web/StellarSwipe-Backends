import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ReportingService } from '../reporting.service';
import { ReportType, ReportPeriod } from '../interfaces/report-format.interface';

export const GENERATE_PERIODIC_REPORTS_QUEUE = 'generate-periodic-reports';

interface PeriodicReportJob {
  type: ReportType;
  period: ReportPeriod;
  periodStart: string;
  periodEnd: string;
}

@Processor(GENERATE_PERIODIC_REPORTS_QUEUE)
export class GeneratePeriodicReportsJob {
  private readonly logger = new Logger(GeneratePeriodicReportsJob.name);

  constructor(private readonly reportingService: ReportingService) {}

  @Process('generate-daily')
  async handleDaily(): Promise<void> {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - 86400000);

    await Promise.all(
      Object.values(ReportType).map((type) =>
        this.reportingService.generatePeriodic(type, ReportPeriod.DAILY, start, end)
          .catch((err) => this.logger.error(`Daily ${type} report failed: ${err.message}`)),
      ),
    );

    this.logger.log(`Daily reports generated for ${end.toISOString().slice(0, 10)}`);
  }

  @Process('generate-monthly')
  async handleMonthly(job: Job<{ year: number; month: number }>): Promise<void> {
    const { year, month } = job.data;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    await Promise.all(
      Object.values(ReportType).map((type) =>
        this.reportingService.generatePeriodic(type, ReportPeriod.MONTHLY, start, end)
          .catch((err) => this.logger.error(`Monthly ${type} report failed: ${err.message}`)),
      ),
    );

    this.logger.log(`Monthly reports generated for ${year}-${month}`);
  }

  @Process('generate-single')
  async handleSingle(job: Job<PeriodicReportJob>) {
    const { type, period, periodStart, periodEnd } = job.data;
    return this.reportingService.generatePeriodic(
      type,
      period,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} (${job.name}) failed: ${error.message}`);
  }
}
