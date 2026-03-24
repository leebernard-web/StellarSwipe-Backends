import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportConfigDto } from './dto/report-config.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';

@Controller('compliance/regulatory-reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post()
  generate(@Body() dto: GenerateReportDto) {
    return this.reportingService.generate(dto);
  }

  @Get()
  list(@Query() query: ReportConfigDto) {
    return this.reportingService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportingService.findOne(id);
  }

  @Post(':id/validate')
  validate(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportingService.validate(id);
  }

  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportingService.submit(id);
  }

  @Get(':id/submission-status')
  submissionStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportingService.getSubmissionStatus(id);
  }
}
