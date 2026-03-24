import { Injectable } from '@nestjs/common';
import { Trade } from '../../../../trades/entities/trade.entity';
import { ReportType, ReportFormat } from '../interfaces/report-format.interface';
import { BaseReportGenerator } from './base-report.generator';
import { toXml, wrapXmlDocument } from '../utils/xml-formatter';
import Big from 'big.js';

@Injectable()
export class SecReportGenerator extends BaseReportGenerator {
  readonly reportType = ReportType.SEC;
  readonly defaultFormat = ReportFormat.XML;

  buildRecords(trades: Trade[]): Record<string, unknown>[] {
    return trades.map((t) => ({
      reportId: t.id,
      entityId: t.userId,
      tradeDate: (t.executedAt ?? t.createdAt).toISOString().slice(0, 10),
      asset: `${t.baseAsset}/${t.counterAsset}`,
      notionalValue: new Big(t.totalValue).toFixed(2),
      counterparty: 'SDEX',
      side: t.side.toUpperCase(),
      feeAmount: t.feeAmount,
      profitLoss: t.profitLoss ?? '0',
      transactionHash: t.transactionHash ?? '',
      ledger: t.ledger ?? '',
    }));
  }

  renderContent(records: Record<string, unknown>[], meta: Record<string, string>): string {
    const items = records.map((r) =>
      toXml('Transaction', r as Record<string, string | number | null>),
    );
    return wrapXmlDocument('SECReport', items, meta);
  }
}
