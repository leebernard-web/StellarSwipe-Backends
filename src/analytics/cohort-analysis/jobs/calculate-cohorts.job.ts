import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CohortAnalyzerService } from '../cohort-analyzer.service';

@Injectable()
export class CalculateCohortsJob {
  private readonly logger = new Logger(CalculateCohortsJob.name);

  constructor(private readonly cohortAnalyzerService: CohortAnalyzerService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async run(): Promise<void> {
    await this.cohortAnalyzerService.analyze({
      cohortType: 'signup_period',
      period: 'month',
      retentionPeriods: 6,
    });
    this.logger.log('Cohort snapshots recalculated');
  }
}
