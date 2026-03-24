import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { RegulatoryReport } from './entities/regulatory-report.entity';
import { SubmissionRecord } from './entities/submission-record.entity';
import { ReportTemplate } from './entities/report-template.entity';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import { FinraReportGenerator } from './generators/finra-report.generator';
import { SecReportGenerator } from './generators/sec-report.generator';
import { Mifid2ReportGenerator } from './generators/mifid2-report.generator';
import { GeneratePeriodicReportsJob, GENERATE_PERIODIC_REPORTS_QUEUE } from './jobs/generate-periodic-reports.job';
import { SubmitReportsJob, SUBMIT_REPORTS_QUEUE } from './jobs/submit-reports.job';
import { Trade } from '../../../trades/entities/trade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RegulatoryReport, SubmissionRecord, ReportTemplate, Trade]),
    BullModule.registerQueue(
      { name: GENERATE_PERIODIC_REPORTS_QUEUE },
      { name: SUBMIT_REPORTS_QUEUE },
    ),
  ],
  providers: [
    ReportingService,
    FinraReportGenerator,
    SecReportGenerator,
    Mifid2ReportGenerator,
    GeneratePeriodicReportsJob,
    SubmitReportsJob,
  ],
  controllers: [ReportingController],
  exports: [ReportingService],
})
export class RegulatoryReportingModule {}
