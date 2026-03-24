import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ReportType, ReportPeriod } from '../interfaces/report-format.interface';
import { RegulatoryReportStatus } from '../entities/regulatory-report.entity';

export class ReportConfigDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportPeriod)
  period!: ReportPeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(RegulatoryReportStatus)
  status?: RegulatoryReportStatus;
}
