export enum ReportFormat {
  XML = 'xml',
  JSON = 'json',
  CSV = 'csv',
}

export enum ReportType {
  FINRA = 'FINRA',
  SEC = 'SEC',
  MIFID2 = 'MIFID2',
}

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export interface ReportField {
  name: string;
  value: string | number | null;
  required: boolean;
}

export interface ReportOutput {
  type: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  content: string;
  recordCount: number;
  checksum: string;
}
