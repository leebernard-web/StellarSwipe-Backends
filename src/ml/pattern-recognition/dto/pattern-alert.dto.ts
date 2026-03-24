import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatternType, PatternCategory, PatternDirection } from '../interfaces/pattern.interface';
import { PatternOutcome } from '../entities/detected-pattern.entity';

/**
 * Emitted whenever a high-confidence pattern is detected.
 * Used by the event bus to notify subscribers (signal generators, dashboards).
 */
export class PatternAlertDto {
  @ApiProperty({ description: 'Detected pattern ID' })
  patternId!: string;

  @ApiProperty({ description: 'Asset pair e.g. "XLM/USDC"' })
  assetPair!: string;

  @ApiProperty({ enum: PatternType })
  patternType!: PatternType;

  @ApiProperty({ enum: PatternCategory })
  category!: PatternCategory;

  @ApiProperty({ enum: PatternDirection })
  direction!: PatternDirection;

  @ApiProperty({ description: 'Confidence 0-100' })
  confidence!: number;

  @ApiProperty({ description: 'Current price at time of alert' })
  currentPrice!: number;

  @ApiPropertyOptional({ description: 'Projected breakout price target' })
  priceTarget?: number;

  @ApiPropertyOptional({ description: 'Suggested stop-loss' })
  stopLoss?: number;

  @ApiPropertyOptional({ description: 'Breakout confirmation level' })
  breakoutLevel?: number;

  @ApiProperty({ description: 'Human-readable alert message' })
  message!: string;

  @ApiProperty({ description: 'When the pattern was first detected' })
  detectedAt!: Date;

  @ApiProperty({ description: 'Risk/reward ratio if target and stop-loss are both set' })
  riskRewardRatio?: number;
}

/**
 * Outcome update emitted when a previously pending pattern resolves.
 */
export class PatternOutcomeDto {
  @ApiProperty({ description: 'Detected pattern ID' })
  patternId!: string;

  @ApiProperty({ description: 'Asset pair' })
  assetPair!: string;

  @ApiProperty({ enum: PatternType })
  patternType!: PatternType;

  @ApiProperty({ enum: PatternOutcome })
  outcome!: PatternOutcome;

  @ApiProperty({ description: 'Price when the outcome was determined' })
  outcomePrice!: number;

  @ApiProperty({ description: 'Actual price move percentage from breakout level' })
  actualMovePct!: number;

  @ApiProperty()
  resolvedAt!: Date;
}
