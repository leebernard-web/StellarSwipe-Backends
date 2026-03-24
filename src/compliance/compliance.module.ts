import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoBlockService } from './geo-blocking/geo-block.service';
import { SanctionsScreeningService } from './geo-blocking/sanctions-screening.service';
import { GeoBlockMiddleware } from './geo-blocking/middleware/geo-block.middleware';
import { ComplianceReportingService } from './compliance-reporting.service';
import { ComplianceController } from './compliance.controller';
import { ComplianceLog } from './entities/compliance-log.entity';
import { RegulatoryReportingModule } from './regulatory-reporting/regulatory-reporting.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ComplianceLog]), RegulatoryReportingModule],
  providers: [GeoBlockService, SanctionsScreeningService, ComplianceReportingService],
  controllers: [ComplianceController],
  exports: [GeoBlockService, SanctionsScreeningService, ComplianceReportingService, RegulatoryReportingModule],
})
export class ComplianceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply geo-blocking to all routes except health checks
    consumer
      .apply(GeoBlockMiddleware)
      .exclude('health', 'health/(.*)')
      .forRoutes('*');
  }
}