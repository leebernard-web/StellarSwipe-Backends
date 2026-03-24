import { Injectable } from '@nestjs/common';
import { Trade } from '../../../../trades/entities/trade.entity';
import { ReportType, ReportFormat } from '../interfaces/report-format.interface';
import { BaseReportGenerator } from './base-report.generator';
import { toXml, wrapXmlDocument } from '../utils/xml-formatter';

@Injectable()
export class Mifid2ReportGenerator extends BaseReportGenerator {
  readonly reportType = ReportType.MIFID2;
  readonly defaultFormat = ReportFormat.XML;

  buildRecords(trades: Trade[]): Record<string, unknown>[] {
    return trades.map((t) => ({
      reportId: t.id,
      lei: `STELLAR${t.userId.replace(/-/g, '').slice(0, 14).toUpperCase()}`,
      tradeDate: (t.executedAt ?? t.createdAt).toISOString(),
      instrument: `${t.baseAsset}/${t.counterAsset}`,
      quantity: t.amount,
      price: t.entryPrice,
      venue: 'SDEX',
      currency: t.counterAsset,
      side: t.side.toUpperCase(),
      totalConsideration: t.totalValue,
      transactionId: t.transactionHash ?? t.id,
    }));
  }

  renderContent(records: Record<string, unknown>[], meta: Record<string, string>): string {
    const items = records.map((r) =>
      toXml('Transaction', r as Record<string, string | number | null>),
    );
    return wrapXmlDocument('MiFID2Report', items, meta);
  }
}
