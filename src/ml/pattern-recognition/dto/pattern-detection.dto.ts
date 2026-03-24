import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import {
  PatternType,
  PatternCategory,
  PatternDirection,
  PatternTimeframe,
} from '../interfaces/pattern.interface';

export class RequestPatternDetectionDto {
  @ApiProperty({ description: 'Asset pair, e.g. "XLM/USDC"' })
  @IsString()
  assetPair!: string;

  @ApiPropertyOptional({ description: 'Number of candles to analyse (default 100)', default: 100 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(500)
  lookback?: number;

  @ApiPropertyOptional({ description: 'Minimum confidence threshold 0-100 (default 45)', default: 45 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minConfidence?: number;

  @ApiPropertyOptional({ description: 'Restrict to a specific pattern category', enum: PatternCategory })
  @IsOptional()
  @IsEnum(PatternCategory)
  category?: PatternCategory;

  @ApiPropertyOptional({ description: 'Force re-detection bypassing the cache', default: false })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class TrendLineDto {
  @ApiProperty() slope!: number;
  @ApiProperty() intercept!: number;
  @ApiProperty({ description: 'R² goodness-of-fit 0-1' }) r2!: number;
  @ApiProperty() startIndex!: number;
  @ApiProperty() endIndex!: number;
  @ApiProperty() startPrice!: number;
  @ApiProperty() endPrice!: number;
  @ApiProperty() touches!: number;
}

export class PivotPointDto {
  @ApiProperty() index!: number;
  @ApiProperty() price!: number;
  @ApiProperty() timestamp!: Date;
  @ApiProperty({ enum: ['HIGH', 'LOW'] }) type!: 'HIGH' | 'LOW';
  @ApiProperty({ description: '0-1 prominence score' }) strength!: number;
}

export class PatternGeometryDto {
  @ApiProperty({ type: [PivotPointDto] }) pivots!: PivotPointDto[];
  @ApiPropertyOptional({ type: TrendLineDto }) upperTrendLine?: TrendLineDto;
  @ApiPropertyOptional({ type: TrendLineDto }) lowerTrendLine?: TrendLineDto;
  @ApiPropertyOptional({ type: TrendLineDto }) neckline?: TrendLineDto;
  @ApiProperty({ description: 'Price range of the pattern' }) patternHeight!: number;
  @ApiProperty({ description: 'Candle span' }) patternWidth!: number;
  @ApiProperty({ description: '0-1 geometric symmetry score' }) symmetryScore!: number;
}

export class DetectedPatternDto {
  @ApiProperty() id!: string;
  @ApiProperty() assetPair!: string;
  @ApiProperty({ enum: PatternType }) patternType!: PatternType;
  @ApiProperty({ enum: PatternCategory }) category!: PatternCategory;
  @ApiProperty({ enum: PatternDirection }) direction!: PatternDirection;
  @ApiProperty({ enum: PatternTimeframe }) timeframe!: PatternTimeframe;
  @ApiProperty({ description: 'Composite confidence score 0-100' }) confidence!: number;
  @ApiProperty() patternStart!: Date;
  @ApiProperty() patternEnd!: Date;
  @ApiProperty() startPrice!: number;
  @ApiProperty() endPrice!: number;
  @ApiPropertyOptional({ description: 'Projected breakout price target' }) priceTarget?: number;
  @ApiPropertyOptional({ description: 'Suggested stop-loss level' }) stopLoss?: number;
  @ApiPropertyOptional({ description: 'Level to watch for breakout confirmation' }) breakoutLevel?: number;
  @ApiProperty({ description: 'Human-readable pattern description' }) description!: string;
  @ApiProperty({ type: PatternGeometryDto }) geometry!: PatternGeometryDto;
  @ApiProperty() detectedAt!: Date;
}

export class PatternDetectionResponseDto {
  @ApiProperty() assetPair!: string;
  @ApiProperty({ type: [DetectedPatternDto] }) patterns!: DetectedPatternDto[];
  @ApiProperty({ description: 'Total patterns found' }) count!: number;
  @ApiProperty({ description: 'Highest confidence pattern' }) topConfidence!: number;
  @ApiProperty() fromCache!: boolean;
  @ApiProperty() analysedAt!: Date;
}
