import { IsEnum, IsDateString, IsOptional, IsString } from 'class-validator';
import { ReportType, ReportFormat, ReportPeriod } from '../interfaces/report-format.interface';

export class GenerateReportDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportPeriod)
  period!: ReportPeriod;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat = ReportFormat.XML;

  @IsOptional()
  @IsString()
  generatedBy?: string;
}
