import { Injectable } from '@nestjs/common';
import {
  OHLCV,
  DetectionResult,
  PatternType,
  PatternCategory,
  PatternDirection,
  PatternTimeframe,
  PatternGeometry,
  PivotPoint,
  TrendLine,
} from '../interfaces/pattern.interface';
import { TrendPatternConfig } from '../interfaces/detection-config.interface';
import { ImageProcessor } from '../utils/image-processor';
import { ShapeMatcher } from '../utils/shape-matcher';

/**
 * TrendPatternDetector identifies directional price channels:
 *  - Uptrend Channel   (higher highs + higher lows)
 *  - Downtrend Channel (lower highs + lower lows)
 *  - Horizontal Channel (ranging / sideways)
 *
 * Algorithm:
 *  1. Detect high and low pivot points.
 *  2. Fit OLS regression lines through high pivots (resistance) and low pivots (support).
 *  3. Classify channel by the sign and magnitude of the slopes.
 *  4. Score by R² fit quality, channel width, and touch count.
 */
@Injectable()
export class TrendPatternDetector {

  detect(candles: OHLCV[], pivots: PivotPoint[], config: TrendPatternConfig): DetectionResult[] {
    if (candles.length < config.minCandles) return [];

    const highPivots = pivots.filter((p) => p.type === 'HIGH');
    const lowPivots = pivots.filter((p) => p.type === 'LOW');

    if (highPivots.length < 2 || lowPivots.length < 2) return [];

    const upperLine = ShapeMatcher.fitTrendLine(highPivots, candles, config.touchTolerance);
    const lowerLine = ShapeMatcher.fitTrendLine(lowPivots, candles, config.touchTolerance);

    if (!upperLine || !lowerLine) return [];
    if (upperLine.r2 < config.r2Threshold && lowerLine.r2 < config.r2Threshold) return [];

    const { min, max } = ImageProcessor.priceRange(candles);
    const meanPrice = (min + max) / 2 || 1;

    const upperRelSlope = upperLine.slope / meanPrice;
    const lowerRelSlope = lowerLine.slope / meanPrice;
    const avgRelSlope = (upperRelSlope + lowerRelSlope) / 2;

    // Channel width = distance between lines at midpoint
    const midIdx = Math.floor((candles.length - 1) / 2);
    const channelWidth =
      ShapeMatcher.priceOnLine(upperLine, midIdx) -
      ShapeMatcher.priceOnLine(lowerLine, midIdx);

    if (channelWidth < meanPrice * config.minChannelWidthFraction) return [];

    const endIdx = candles.length - 1;
    const timeframe = this.classifyTimeframe(candles.length);

    let patternType: PatternType;
    let direction: PatternDirection;
    let description: string;

    if (Math.abs(avgRelSlope) < config.slopeThreshold) {
      patternType = PatternType.HORIZONTAL_CHANNEL;
      direction = PatternDirection.NEUTRAL;
      description = `Horizontal channel: price ranging between ${lowerLine.endPrice.toFixed(4)} and ${upperLine.endPrice.toFixed(4)}.`;
    } else if (avgRelSlope > 0) {
      patternType = PatternType.UPTREND_CHANNEL;
      direction = PatternDirection.BULLISH;
      description = `Uptrend channel: ascending support and resistance confirm bullish bias.`;
    } else {
      patternType = PatternType.DOWNTREND_CHANNEL;
      direction = PatternDirection.BEARISH;
      description = `Downtrend channel: descending support and resistance confirm bearish bias.`;
    }

    const avgR2 = (upperLine.r2 + lowerLine.r2) / 2;
    const touchBonus = Math.min(0.1, ((upperLine.touches + lowerLine.touches) - 4) * 0.01);
    const confidence = Math.min(0.95, avgR2 * 0.85 + touchBonus);

    const geometry: PatternGeometry = {
      pivots: [...highPivots, ...lowPivots].sort((a, b) => a.index - b.index),
      upperTrendLine: upperLine,
      lowerTrendLine: lowerLine,
      keyLevels: [],
      patternHeight: channelWidth,
      patternWidth: candles.length,
      symmetryScore: this.channelSymmetry(upperLine, lowerLine),
    };

    const breakoutLevel =
      direction === PatternDirection.BULLISH
        ? ShapeMatcher.priceOnLine(upperLine, endIdx)
        : ShapeMatcher.priceOnLine(lowerLine, endIdx);

    return [
      {
        patternType,
        category: PatternCategory.TREND,
        direction,
        timeframe,
        confidence,
        startIndex: 0,
        endIndex: endIdx,
        startDate: candles[0].timestamp,
        endDate: candles[endIdx].timestamp,
        geometry,
        breakoutLevel,
        priceTarget: direction !== PatternDirection.NEUTRAL
          ? ShapeMatcher.measuredMoveTarget(breakoutLevel, channelWidth, direction === PatternDirection.BULLISH)
          : undefined,
        stopLoss:
          direction === PatternDirection.BULLISH
            ? ShapeMatcher.priceOnLine(lowerLine, endIdx)
            : ShapeMatcher.priceOnLine(upperLine, endIdx),
        description,
        metadata: {
          upperSlope: upperRelSlope,
          lowerSlope: lowerRelSlope,
          avgR2,
          channelWidth,
          upperTouches: upperLine.touches,
          lowerTouches: lowerLine.touches,
        },
      },
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private channelSymmetry(upper: TrendLine, lower: TrendLine): number {
    // Symmetric when both lines slope by similar magnitude
    const slopeDiff = Math.abs(upper.slope - lower.slope);
    const avgAbs = (Math.abs(upper.slope) + Math.abs(lower.slope)) / 2;
    if (avgAbs === 0) return 1;
    return Math.max(0, 1 - slopeDiff / avgAbs);
  }

  private classifyTimeframe(bars: number): PatternTimeframe {
    if (bars <= 20) return PatternTimeframe.SHORT;
    if (bars <= 60) return PatternTimeframe.MEDIUM;
    return PatternTimeframe.LONG;
  }
}
