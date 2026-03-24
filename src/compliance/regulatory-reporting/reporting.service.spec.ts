import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { RegulatoryReport, RegulatoryReportStatus } from './entities/regulatory-report.entity';
import { SubmissionRecord } from './entities/submission-record.entity';
import { ReportType, ReportFormat, ReportPeriod } from './interfaces/report-format.interface';
import { FinraReportGenerator } from './generators/finra-report.generator';
import { SecReportGenerator } from './generators/sec-report.generator';
import { Mifid2ReportGenerator } from './generators/mifid2-report.generator';
import { Trade, TradeStatus, TradeSide } from '../../trades/entities/trade.entity';

const mockRepo = () => ({
  create: jest.fn((v) => v),
  save: jest.fn((v) => Promise.resolve({ id: 'report-1', ...v })),
  findOne: jest.fn(),
  find: jest.fn(),
});

const mockTrade = (): Partial<Trade> => ({
  id: 'trade-1',
  userId: 'user-1',
  baseAsset: 'XLM',
  counterAsset: 'USDC',
  side: TradeSide.BUY,
  amount: '100.0000000',
  entryPrice: '0.1200000',
  totalValue: '12.0000000',
  feeAmount: '0.0120000',
  status: TradeStatus.SETTLED,
  transactionHash: 'abc123',
  createdAt: new Date(),
  executedAt: new Date(),
});

describe('ReportingService', () => {
  let service: ReportingService;
  let reportRepo: ReturnType<typeof mockRepo>;
  let submissionRepo: ReturnType<typeof mockRepo>;
  let tradeRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        FinraReportGenerator,
        SecReportGenerator,
        Mifid2ReportGenerator,
        { provide: getRepositoryToken(RegulatoryReport), useFactory: mockRepo },
        { provide: getRepositoryToken(SubmissionRecord), useFactory: mockRepo },
        { provide: getRepositoryToken(Trade), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(ReportingService);
    reportRepo = module.get(getRepositoryToken(RegulatoryReport));
    submissionRepo = module.get(getRepositoryToken(SubmissionRecord));
    tradeRepo = module.get(getRepositoryToken(Trade));
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('generate', () => {
    it('generates a FINRA report with correct record count', async () => {
      tradeRepo.find.mockResolvedValue([mockTrade(), mockTrade()]);

      const result = await service.generate({
        type: ReportType.FINRA,
        period: ReportPeriod.DAILY,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-02',
        format: ReportFormat.XML,
      });

      expect(reportRepo.save).toHaveBeenCalledTimes(1);
      expect(result.recordCount).toBe(2);
      expect(result.type).toBe(ReportType.FINRA);
    });

    it('generates a MiFID II report', async () => {
      tradeRepo.find.mockResolvedValue([mockTrade()]);

      const result = await service.generate({
        type: ReportType.MIFID2,
        period: ReportPeriod.MONTHLY,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      });

      expect(result.type).toBe(ReportType.MIFID2);
      expect(result.checksum).toBeDefined();
    });

    it('throws BadRequestException for unsupported type', async () => {
      await expect(
        service.generate({
          type: 'UNKNOWN' as ReportType,
          period: ReportPeriod.DAILY,
          periodStart: '2024-01-01',
          periodEnd: '2024-01-02',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit', () => {
    it('submits a validated report and returns submission status', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'report-1',
        type: ReportType.SEC,
        status: RegulatoryReportStatus.VALIDATED,
      });
      submissionRepo.save.mockResolvedValue({ submittedAt: new Date() });

      const result = await service.submit('report-1');

      expect(result.submissionId).toMatch(/^SUB-SEC-/);
      expect(result.referenceNumber).toBeDefined();
    });

    it('throws BadRequestException if report is not validated', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'report-1',
        status: RegulatoryReportStatus.GENERATED,
      });

      await expect(service.submit('report-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when report does not exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubmissionStatus', () => {
    it('returns submission status for a report', async () => {
      submissionRepo.findOne.mockResolvedValue({
        reportId: 'report-1',
        status: 'submitted',
        submissionId: 'SUB-FINRA-123',
        retryCount: 0,
      });

      const result = await service.getSubmissionStatus('report-1');
      expect(result.submissionId).toBe('SUB-FINRA-123');
    });

    it('throws NotFoundException when no submission exists', async () => {
      submissionRepo.findOne.mockResolvedValue(null);
      await expect(service.getSubmissionStatus('report-1')).rejects.toThrow(NotFoundException);
    });
  });
});
