import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryAnalyzerService } from './optimization/query-analyzer.service';
import { IndexManagerService } from './optimization/index-manager.service';
import { MaterializedViewService } from './optimization/materialized-view.service';
import { SignalPerformance } from '../signals/entities/signal-performance.entity';
import { DeadlockRetryInterceptor } from './deadlock-retry.interceptor';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SignalPerformance])],
  providers: [
    QueryAnalyzerService,
    IndexManagerService,
    MaterializedViewService,
    DeadlockRetryInterceptor,
  ],
  exports: [
    QueryAnalyzerService,
    IndexManagerService,
    MaterializedViewService,
    DeadlockRetryInterceptor,
  ],
})
export class DatabaseOptimizationModule {}
