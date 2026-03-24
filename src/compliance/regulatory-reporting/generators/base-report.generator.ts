import { Trade } from '../../../../trades/entities/trade.entity';
import { ReportOutput, ReportType, ReportFormat, ReportPeriod } from '../interfaces/report-format.interface';
import { validateReport, computeChecksum } from '../utils/validation-engine';

export abstract class BaseReportGenerator {
  abstract readonly reportType: ReportType;
  abstract readonly defaultFormat: ReportFormat;

  abstract buildRecords(trades: Trade[]): Record<string, unknown>[];
  abstract renderContent(records: Record<string, unknown>[], meta: Record<string, string>): string;

  generate(
    trades: Trade[],
    period: ReportPeriod,
    periodStart: Date,
    periodEnd: Date,
  ): ReportOutput {
    const records = this.buildRecords(trades);
    const validation = validateReport(this.reportType, records);

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    const meta = {
      reportType: this.reportType,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      recordCount: String(records.length),
    };

    const content = this.renderContent(records, meta);
    const checksum = computeChecksum(content);

    return {
      type: this.reportType,
      format: this.defaultFormat,
      period,
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      content,
      recordCount: records.length,
      checksum,
    };
  }
}
