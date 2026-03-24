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
import { ConsolidationPatternConfig } from '../interfaces/detection-config.interface';
import { ImageProcessor } from '../utils/image-processor';
import { ShapeMatcher } from '../utils/shape-matcher';

/**
 * ConsolidationPatternDetector identifies price compression / continuation formations:
 *
 *  Triangles:   Ascending, Descending, Symmetric
 *  Rectangle:   Horizontal consolidation box
 *  Flags:       Bull / Bear flag (sharp pole + tight channel)
 *  Pennant:     Converging symmetric triangle after a sharp move
 *  Wedges:      Rising Wedge (bearish), Falling Wedge (bullish)
 *
 * All patterns share the same two-trendline framework.
 * They are differentiated by:
 *   - Whether lines converge or are parallel
 *   - Slope direction of each line
 *   - Volume behaviour (declining expected for consolidation)
 */
@Injectable()
export class ConsolidationPatternDetector {

  detect(candles: OHLCV[], pivots: PivotPoint[], config: ConsolidationPatternConfig): DetectionResult[] {
    if (candles.length < config.minConvergenceBars) return [];

    const highPivots = pivots.filter((p) => p.type === 'HIGH').sort((a, b) => a.index - b.index);
    const lowPivots = pivots.filter((p) => p.type === 'LOW').sort((a, b) => a.index - b.index);

    if (highPivots.length < 2 || lowPivots.length < 2) return [];

    const upperLine = ShapeMatcher.fitTrendLine(highPivots, candles, 0.015);
    const lowerLine = ShapeMatcher.fitTrendLine(lowPivots, candles, 0.015);

    if (!upperLine || !lowerLine) return [];

    const results: DetectionResult[] = [];
    const endIdx = candles.length - 1;
    const { min, max } = ImageProcessor.priceRange(candles);
    const meanPrice = (min + max) / 2 || 1;

    const upperRelSlope = upperLine.slope / meanPrice;
    const lowerRelSlope = lowerLine.slope / meanPrice;
    const flat = config.flatSlopeTolerance;

    const volumeDeclines = ImageProcessor.isVolumeDeclining(candles, config.volumeDeclineFactor);

    // Channel width at beginning and end — convergence test
    const widthStart =
      ShapeMatcher.priceOnLine(upperLine, upperLine.startIndex) -
      ShapeMatcher.priceOnLine(lowerLine, lowerLine.startIndex);
    const widthEnd =
      ShapeMatcher.priceOnLine(upperLine, endIdx) -
      ShapeMatcher.priceOnLine(lowerLine, endIdx);
    const isConverging = widthEnd < widthStart * 0.85;
    const isParallel = !isConverging && Math.abs(widthEnd - widthStart) / Math.max(widthStart, 1) < 0.15;

    // ── Symmetric Triangle ─────────────────────────────────────────────────
    if (isConverging && upperRelSlope < -flat && lowerRelSlope > flat) {
      const apexIdx = ShapeMatcher.findConvergencePoint(upperLine, lowerLine);
      if (apexIdx && apexIdx - endIdx <= candles.length * config.maxApexFraction) {
        results.push(
          this.build(candles, upperLine, lowerLine, pivots, endIdx,
            PatternType.SYMMETRIC_TRIANGLE, PatternDirection.NEUTRAL,
            0.65 + (volumeDeclines ? 0.10 : 0),
            `Symmetric Triangle: converging trendlines; breakout direction undecided.`,
            { apexIdx, volumeDeclines }),
        );
      }
    }

    // ── Ascending Triangle ─────────────────────────────────────────────────
    if (isConverging && Math.abs(upperRelSlope) <= flat && lowerRelSlope > flat) {
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          PatternType.ASCENDING_TRIANGLE, PatternDirection.BULLISH,
          0.70 + (volumeDeclines ? 0.10 : 0),
          `Ascending Triangle: flat resistance at ${upperLine.endPrice.toFixed(4)}; rising support signals bullish breakout.`,
          { resistance: upperLine.endPrice, volumeDeclines }),
      );
    }

    // ── Descending Triangle ────────────────────────────────────────────────
    if (isConverging && upperRelSlope < -flat && Math.abs(lowerRelSlope) <= flat) {
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          PatternType.DESCENDING_TRIANGLE, PatternDirection.BEARISH,
          0.70 + (volumeDeclines ? 0.10 : 0),
          `Descending Triangle: flat support at ${lowerLine.endPrice.toFixed(4)}; falling resistance signals bearish breakout.`,
          { support: lowerLine.endPrice, volumeDeclines }),
      );
    }

    // ── Rectangle ─────────────────────────────────────────────────────────
    if (isParallel && Math.abs(upperRelSlope) <= flat && Math.abs(lowerRelSlope) <= flat) {
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          PatternType.RECTANGLE, PatternDirection.NEUTRAL,
          0.65 + (volumeDeclines ? 0.08 : 0),
          `Rectangle: horizontal consolidation between ${lowerLine.endPrice.toFixed(4)} and ${upperLine.endPrice.toFixed(4)}.`,
          { upper: upperLine.endPrice, lower: lowerLine.endPrice }),
      );
    }

    // ── Rising Wedge (bearish) ─────────────────────────────────────────────
    if (isConverging && upperRelSlope > flat && lowerRelSlope > flat && lowerRelSlope > upperRelSlope) {
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          PatternType.RISING_WEDGE, PatternDirection.BEARISH,
          0.68 + (volumeDeclines ? 0.10 : 0),
          `Rising Wedge: both trendlines slope up but support rises faster; typically bearish.`,
          { upperSlope: upperRelSlope, lowerSlope: lowerRelSlope, volumeDeclines }),
      );
    }

    // ── Falling Wedge (bullish) ────────────────────────────────────────────
    if (isConverging && upperRelSlope < -flat && lowerRelSlope < -flat && upperRelSlope < lowerRelSlope) {
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          PatternType.FALLING_WEDGE, PatternDirection.BULLISH,
          0.68 + (volumeDeclines ? 0.10 : 0),
          `Falling Wedge: both trendlines slope down but resistance falls faster; typically bullish.`,
          { upperSlope: upperRelSlope, lowerSlope: lowerRelSlope, volumeDeclines }),
      );
    }

    // ── Flag / Pennant detection requires a strong prior move (the pole) ────
    const flagResults = this.detectFlagsPennants(candles, upperLine, lowerLine, pivots, isConverging, config, endIdx);
    results.push(...flagResults);

    return results;
  }

  // ── Flag & Pennant ────────────────────────────────────────────────────────

  private detectFlagsPennants(
    candles: OHLCV[],
    upperLine: TrendLine,
    lowerLine: TrendLine,
    pivots: PivotPoint[],
    isConverging: boolean,
    config: ConsolidationPatternConfig,
    endIdx: number,
  ): DetectionResult[] {
    if (candles.length < 10) return [];

    const poleLength = Math.min(10, Math.floor(candles.length * 0.3));
    const pole = candles.slice(0, poleLength);
    const { min: poleMin, max: poleMax } = ImageProcessor.priceRange(pole);
    const poleMove = (poleMax - poleMin) / Math.max(poleMin, 1);

    // Need a strong pole (>3% move) to qualify as flag/pennant
    if (poleMove < 0.03) return [];

    const bullPole = pole[poleLength - 1].close > pole[0].close;
    const consolidationCandles = candles.slice(poleLength);
    const { min, max } = ImageProcessor.priceRange(consolidationCandles);
    const meanPrice = (min + max) / 2 || 1;
    const upperRelSlope = upperLine.slope / meanPrice;
    const lowerRelSlope = lowerLine.slope / meanPrice;
    const flat = config.flatSlopeTolerance;

    const results: DetectionResult[] = [];

    if (isConverging) {
      // Pennant: symmetric triangle after strong move
      const confidence = Math.min(0.88, 0.68 + poleMove * 0.5);
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          PatternType.PENNANT, bullPole ? PatternDirection.BULLISH : PatternDirection.BEARISH,
          confidence,
          `${bullPole ? 'Bull' : 'Bear'} Pennant: tight consolidation after ${(poleMove * 100).toFixed(1)}% pole move.`,
          { poleMovePct: poleMove * 100, isBullPole: bullPole }),
      );
    } else if (Math.abs(upperRelSlope) < 0.003 && Math.abs(lowerRelSlope) < 0.003) {
      // Flag: parallel channel counter to the pole direction
      const confidence = Math.min(0.86, 0.64 + poleMove * 0.4);
      results.push(
        this.build(candles, upperLine, lowerLine, pivots, endIdx,
          bullPole ? PatternType.FLAG_BULL : PatternType.FLAG_BEAR,
          bullPole ? PatternDirection.BULLISH : PatternDirection.BEARISH,
          confidence,
          `${bullPole ? 'Bull' : 'Bear'} Flag: parallel consolidation after ${(poleMove * 100).toFixed(1)}% pole move.`,
          { poleMovePct: poleMove * 100, isBullPole: bullPole }),
      );
    }

    return results;
  }

  // ── Builder ───────────────────────────────────────────────────────────────

  private build(
    candles: OHLCV[],
    upperLine: TrendLine,
    lowerLine: TrendLine,
    pivots: PivotPoint[],
    endIdx: number,
    type: PatternType,
    direction: PatternDirection,
    rawConfidence: number,
    description: string,
    metadata: Record<string, unknown>,
  ): DetectionResult {
    const { min, max } = ImageProcessor.priceRange(candles);
    const patternHeight = max - min;

    const upperEnd = ShapeMatcher.priceOnLine(upperLine, endIdx);
    const lowerEnd = ShapeMatcher.priceOnLine(lowerLine, endIdx);
    const channelWidth = upperEnd - lowerEnd;

    const isBullish = direction === PatternDirection.BULLISH;
    const breakoutLevel = isBullish ? upperEnd : lowerEnd;

    const geometry: PatternGeometry = {
      pivots: [...pivots],
      upperTrendLine: upperLine,
      lowerTrendLine: lowerLine,
      keyLevels: [],
      patternHeight,
      patternWidth: candles.length,
      symmetryScore: Math.min(1, (upperLine.r2 + lowerLine.r2) / 2),
    };

    return {
      patternType: type,
      category: PatternCategory.CONSOLIDATION,
      direction,
      timeframe: this.classifyTimeframe(candles.length),
      confidence: Math.max(0, Math.min(0.97, rawConfidence)),
      startIndex: 0,
      endIndex: endIdx,
      startDate: candles[0].timestamp,
      endDate: candles[endIdx].timestamp,
      geometry,
      breakoutLevel,
      priceTarget: direction !== PatternDirection.NEUTRAL
        ? ShapeMatcher.measuredMoveTarget(breakoutLevel, patternHeight, isBullish)
        : undefined,
      stopLoss:
        direction === PatternDirection.BULLISH ? lowerEnd * 0.99
        : direction === PatternDirection.BEARISH ? upperEnd * 1.01
        : undefined,
      description,
      metadata: {
        ...metadata,
        channelWidth,
        upperR2: upperLine.r2,
        lowerR2: lowerLine.r2,
        upperTouches: upperLine.touches,
        lowerTouches: lowerLine.touches,
      },
    };
  }

  private classifyTimeframe(bars: number): PatternTimeframe {
    if (bars <= 20) return PatternTimeframe.SHORT;
    if (bars <= 60) return PatternTimeframe.MEDIUM;
    return PatternTimeframe.LONG;
  }
}
