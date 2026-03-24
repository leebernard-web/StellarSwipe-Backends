import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { RegulatoryReport, RegulatoryReportStatus } from './entities/regulatory-report.entity';
import { SubmissionRecord } from './entities/submission-record.entity';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportConfigDto } from './dto/report-config.dto';
import { SubmissionStatusDto } from './dto/submission-status.dto';
import { ReportType, ReportFormat, ReportPeriod } from './interfaces/report-format.interface';
import { SubmissionStatus } from './interfaces/submission-api.interface';
import { FinraReportGenerator } from './generators/finra-report.generator';
import { SecReportGenerator } from './generators/sec-report.generator';
import { Mifid2ReportGenerator } from './generators/mifid2-report.generator';
import { BaseReportGenerator } from './generators/base-report.generator';
import { validateReport } from './utils/validation-engine';
import { Trade, TradeStatus } from '../../trades/entities/trade.entity';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly generators: Map<ReportType, BaseReportGenerator>;

  constructor(
    @InjectRepository(RegulatoryReport)
    private readonly reportRepo: Repository<RegulatoryReport>,
    @InjectRepository(SubmissionRecord)
    private readonly submissionRepo: Repository<SubmissionRecord>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    private readonly finraGenerator: FinraReportGenerator,
    private readonly secGenerator: SecReportGenerator,
    private readonly mifid2Generator: Mifid2ReportGenerator,
  ) {
    this.generators = new Map([
      [ReportType.FINRA, this.finraGenerator],
      [ReportType.SEC, this.secGenerator],
      [ReportType.MIFID2, this.mifid2Generator],
    ]);
  }

  async generate(dto: GenerateReportDto): Promise<RegulatoryReport> {
    const generator = this.generators.get(dto.type);
    if (!generator) throw new BadRequestException(`Unsupported report type: ${dto.type}`);

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    const trades = await this.tradeRepo.find({
      where: {
        status: TradeStatus.SETTLED,
        createdAt: Between(periodStart, periodEnd),
      },
    });

    const output = generator.generate(
      trades,
      dto.period,
      periodStart,
      periodEnd,
    );

    const report = this.reportRepo.create({
      type: dto.type,
      format: dto.format ?? ReportFormat.XML,
      period: dto.period,
      periodStart,
      periodEnd,
      status: RegulatoryReportStatus.GENERATED,
      recordCount: output.recordCount,
      content: output.content,
      checksum: output.checksum,
      generatedBy: dto.generatedBy,
    });

    const saved = await this.reportRepo.save(report);
    this.logger.log(`Generated ${dto.type} report ${saved.id}: ${output.recordCount} records`);
    return saved;
  }

  async validate(reportId: string): Promise<{ valid: boolean; errors: string[] }> {
    const report = await this.findOne(reportId);
    const generator = this.generators.get(report.type)!;

    const trades = await this.tradeRepo.find({
      where: {
        status: TradeStatus.SETTLED,
        createdAt: Between(report.periodStart, report.periodEnd),
      },
    });

    const records = generator.buildRecords(trades);
    const result = validateReport(report.type, records);

    report.status = result.valid
      ? RegulatoryReportStatus.VALIDATED
      : RegulatoryReportStatus.FAILED;
    report.validationErrors = result.errors;
    await this.reportRepo.save(report);

    return result;
  }

  async submit(reportId: string): Promise<SubmissionStatusDto> {
    const report = await this.findOne(reportId);

    if (report.status !== RegulatoryReportStatus.VALIDATED) {
      throw new BadRequestException('Report must be validated before submission');
    }

    // Simulate external submission — replace with real API call per regulator
    const submissionId = `SUB-${report.type}-${Date.now()}`;
    const referenceNumber = `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const submission = this.submissionRepo.create({
      reportId,
      status: SubmissionStatus.SUBMITTED,
      submissionId,
      referenceNumber,
      submittedAt: new Date(),
    });

    await this.submissionRepo.save(submission);
    report.status = RegulatoryReportStatus.SUBMITTED;
    await this.reportRepo.save(report);

    this.logger.log(`Submitted ${report.type} report ${reportId} → ${submissionId}`);

    return {
      reportId,
      submissionId,
      status: SubmissionStatus.SUBMITTED,
      referenceNumber,
      submittedAt: submission.submittedAt,
      retryCount: 0,
    };
  }

  async getSubmissionStatus(reportId: string): Promise<SubmissionStatusDto> {
    const submission = await this.submissionRepo.findOne({
      where: { reportId },
      order: { createdAt: 'DESC' },
    });

    if (!submission) throw new NotFoundException(`No submission found for report ${reportId}`);

    return {
      reportId,
      submissionId: submission.submissionId,
      status: submission.status,
      referenceNumber: submission.referenceNumber,
      submittedAt: submission.submittedAt,
      acknowledgedAt: submission.acknowledgedAt,
      rejectionReason: submission.rejectionReason,
      retryCount: submission.retryCount,
    };
  }

  async list(query: ReportConfigDto): Promise<RegulatoryReport[]> {
    const where: any = { type: query.type };
    if (query.status) where.status = query.status;
    if (query.startDate && query.endDate) {
      where.periodStart = Between(new Date(query.startDate), new Date(query.endDate));
    }
    return this.reportRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<RegulatoryReport> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async generatePeriodic(
    type: ReportType,
    period: ReportPeriod,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RegulatoryReport> {
    return this.generate({
      type,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      format: ReportFormat.XML,
      generatedBy: 'scheduler',
    });
  }
}
