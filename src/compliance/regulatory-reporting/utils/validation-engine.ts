import { createHash } from 'crypto';
import { ReportType } from '../interfaces/report-format.interface';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_FIELDS: Record<ReportType, string[]> = {
  [ReportType.FINRA]: ['reportId', 'firmId', 'tradeDate', 'symbol', 'quantity', 'price', 'side'],
  [ReportType.SEC]:   ['reportId', 'entityId', 'tradeDate', 'asset', 'notionalValue', 'counterparty'],
  [ReportType.MIFID2]:['reportId', 'lei', 'tradeDate', 'instrument', 'quantity', 'price', 'venue', 'currency'],
};

export function validateReport(type: ReportType, records: Record<string, unknown>[]): ValidationResult {
  const errors: string[] = [];
  const required = REQUIRED_FIELDS[type];

  records.forEach((record, i) => {
    for (const field of required) {
      if (record[field] === undefined || record[field] === null || record[field] === '') {
        errors.push(`Record[${i}]: missing required field "${field}"`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

export function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
