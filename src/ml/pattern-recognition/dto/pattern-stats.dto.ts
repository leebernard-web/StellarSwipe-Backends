import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatternType, PatternDirection } from '../interfaces/pattern.interface';

export class PatternSuccessRateDto {
  @ApiProperty({ enum: PatternType }) patternType!: PatternType;
  @ApiProperty({ enum: PatternDirection }) direction!: PatternDirection;
  @ApiProperty({ description: 'Total patterns detected' }) totalDetected!: number;
  @ApiProperty({ description: 'Total patterns resolved' }) totalResolved!: number;
  @ApiProperty({ description: 'Success rate 0-1 (null until resolved)' }) successRate!: number | null;
  @ApiProperty({ description: 'Average price move % on successful patterns' }) avgMovePct!: number | null;
  @ApiProperty({ description: 'Average confidence score at detection' }) avgConfidence!: number | null;
  @ApiProperty({ description: 'Average bars to resolution' }) avgBarsToResolution!: number | null;
}

export class PatternFrequencyDto {
  @ApiProperty({ enum: PatternType }) patternType!: PatternType;
  @ApiProperty({ description: 'Number of detections in the period' }) count!: number;
  @ApiProperty({ description: 'Fraction of all detections 0-1' }) frequency!: number;
}

export class AssetPatternStatsDto {
  @ApiProperty({ description: 'Asset pair e.g. "XLM/USDC"' })
  assetPair!: string;

  @ApiProperty({ description: 'Total patterns detected for this asset pair' })
  totalDetections!: number;

  @ApiProperty({ description: 'Overall success rate 0-1 across all pattern types' })
  overallSuccessRate!: number | null;

  @ApiProperty({ type: [PatternSuccessRateDto], description: 'Per-pattern breakdown' })
  byPatternType!: PatternSuccessRateDto[];

  @ApiProperty({ type: [PatternFrequencyDto], description: 'Most frequent patterns' })
  mostFrequent!: PatternFrequencyDto[];

  @ApiProperty({ description: 'Average confidence of all detected patterns' })
  avgConfidence!: number;

  @ApiProperty({ description: 'Period covered by these stats' })
  periodDays!: number;
}

export class GlobalPatternStatsDto {
  @ApiProperty({ description: 'Total patterns across all asset pairs' })
  totalDetections!: number;

  @ApiProperty({ description: 'Total resolved patterns' })
  totalResolved!: number;

  @ApiProperty({ description: 'Global success rate 0-1' })
  globalSuccessRate!: number | null;

  @ApiProperty({ type: [PatternSuccessRateDto], description: 'Ranked by success rate' })
  topPerformingPatterns!: PatternSuccessRateDto[];

  @ApiProperty({ type: [AssetPatternStatsDto], description: 'Most active asset pairs' })
  topAssetPairs!: AssetPatternStatsDto[];

  @ApiProperty({ description: 'Average confidence across all detections' })
  avgConfidence!: number;

  @ApiPropertyOptional({ description: 'Daily detection volume for the past 30 days' })
  dailyDetections?: Array<{ date: string; count: number }>;

  @ApiProperty()
  computedAt!: Date;
}
