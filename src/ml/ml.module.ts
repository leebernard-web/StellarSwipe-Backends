import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Signal } from '../signals/entities/signal.entity';
import { ProviderStats } from '../signals/entities/provider-stats.entity';
import { PriceOracleModule } from '../prices/price-oracle.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PriceHistory } from '../prices/entities/price-history.entity';
// Legacy forecasting
import { FeatureEngineeringService } from './forecasting/feature-engineering.service';
import { ModelTrainingService } from './forecasting/model-training.service';
import { SignalForecastingService } from './forecasting/signal-forecasting.service';
import { SignalPredictorModel } from './models/signal-predictor.model';
import { SignalForecastingController } from './forecasting/signal-forecasting.controller';
// Signal prediction (ML ensemble)
import { Prediction } from './signal-prediction/entities/prediction.entity';
import { TrainingData } from './signal-prediction/entities/training-data.entity';
import { ModelVersion } from './signal-prediction/entities/model-version.entity';
import { FeatureExtractorService } from './signal-prediction/feature-extractor.service';
import { ModelTrainerService } from './signal-prediction/model-trainer.service';
import { SignalPredictorService } from './signal-prediction/signal-predictor.service';
import { RetrainModelsJob } from './signal-prediction/jobs/retrain-models.job';
import { ValidatePredictionsJob } from './signal-prediction/jobs/validate-predictions.job';
import { UpdateFeaturesJob } from './signal-prediction/jobs/update-features.job';
// Pattern recognition
import { DetectedPattern } from './pattern-recognition/entities/detected-pattern.entity';
import { PatternHistory } from './pattern-recognition/entities/pattern-history.entity';
import { CandlestickPatternDetector } from './pattern-recognition/detectors/candlestick-pattern.detector';
import { TrendPatternDetector } from './pattern-recognition/detectors/trend-pattern.detector';
import { ReversalPatternDetector } from './pattern-recognition/detectors/reversal-pattern.detector';
import { ConsolidationPatternDetector } from './pattern-recognition/detectors/consolidation-pattern.detector';
import { ChartAnalyzerService } from './pattern-recognition/chart-analyzer.service';
import { PatternDetectorService } from './pattern-recognition/pattern-detector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Signal,
      ProviderStats,
      Prediction,
      TrainingData,
      ModelVersion,
      // Pattern recognition
      DetectedPattern,
      PatternHistory,
      PriceHistory,
    ]),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PriceOracleModule,
    AnalyticsModule,
  ],
  controllers: [SignalForecastingController],
  providers: [
    // Legacy forecasting
    FeatureEngineeringService,
    ModelTrainingService,
    SignalForecastingService,
    SignalPredictorModel,
    // Signal prediction (ML ensemble)
    FeatureExtractorService,
    ModelTrainerService,
    SignalPredictorService,
    RetrainModelsJob,
    ValidatePredictionsJob,
    UpdateFeaturesJob,
    // Pattern recognition
    CandlestickPatternDetector,
    TrendPatternDetector,
    ReversalPatternDetector,
    ConsolidationPatternDetector,
    ChartAnalyzerService,
    PatternDetectorService,
  ],
  exports: [
    SignalForecastingService,
    SignalPredictorService,
    ModelTrainerService,
    PatternDetectorService,
    ChartAnalyzerService,
  ],
})
export class MlModule {}
