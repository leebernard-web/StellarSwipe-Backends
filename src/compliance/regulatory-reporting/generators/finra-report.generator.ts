import { Injectable } from '@nestjs/common';
import { Trade } from '../../../../trades/entities/trade.entity';
import { ReportType, ReportFormat } from '../interfaces/report-format.interface';
import { BaseReportGenerator } from './base-report.generator';
import { toXml, wrapXmlDocument } from '../utils/xml-formatter';

@Injectable()
export class FinraReportGenerator extends BaseReportGenerator {
  readonly reportType = ReportType.FINRA;
  readonly defaultFormat = ReportFormat.XML;

  buildRecords(trades: Trade[]): Record<string, unknown>[] {
    return trades.map((t) => ({
      reportId: t.id,
      firmId: 'STELLARSWIPE-001',
      tradeDate: (t.executedAt ?? t.createdAt).toISOString().slice(0, 10),
      symbol: `${t.baseAsset}/${t.counterAsset}`,
      quantity: t.amount,
      price: t.entryPrice,
      side: t.side.toUpperCase(),
      totalValue: t.totalValue,
      transactionHash: t.transactionHash ?? '',
      status: t.status,
    }));
  }

  renderContent(records: Record<string, unknown>[], meta: Record<string, string>): string {
    const items = records.map((r) =>
      toXml('Trade', r as Record<string, string | number | null>),
    );
    return wrapXmlDocument('FINRAReport', items, meta);
  }
}
