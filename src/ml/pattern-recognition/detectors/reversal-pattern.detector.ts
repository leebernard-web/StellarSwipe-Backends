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
} from '../interfaces/pattern.interface';
import { ReversalPatternConfig } from '../interfaces/detection-config.interface';
import { ImageProcessor } from '../utils/image-processor';
import { ShapeMatcher } from '../utils/shape-matcher';

/**
 * ReversalPatternDetector identifies major price-reversal formations:
 *
 *  Head & Shoulders (H&S)  — bearish reversal at top
 *  Inverse H&S             — bullish reversal at bottom
 *  Double Top / Bottom     — two-peak / two-trough reversals
 *  Triple Top / Bottom     — three-peak / three-trough reversals
 *
 * Detection approach:
 *  - Select significant pivot highs (for top patterns) or lows (for bottom patterns)
 *  - Check geometric relationships between pivots
 *  - Fit neckline through the troughs / peaks between the main peaks
 *  - Score by symmetry, neckline slope, and head prominence
 */
@Injectable()
export class ReversalPatternDetector {

  detect(candles: OHLCV[], pivots: PivotPoint[], config: ReversalPatternConfig): DetectionResult[] {
    if (candles.length < config.minPatternBars) return [];

    const results: DetectionResult[] = [];
    const highPivots = pivots.filter((p) => p.type === 'HIGH').sort((a, b) => a.index - b.index);
    const lowPivots = pivots.filter((p) => p.type === 'LOW').sort((a, b) => a.index - b.index);

    // ── Top patterns (highs) ───────────────────────────────────────────────
    results.push(...this.detectHeadAndShoulders(candles, highPivots, lowPivots, config));
    results.push(...this.detectDoubleTop(candles, highPivots, lowPivots, config));
    results.push(...this.detectTripleTop(candles, highPivots, lowPivots, config));

    // ── Bottom patterns (lows) ─────────────────────────────────────────────
    results.push(...this.detectInverseHeadAndShoulders(candles, lowPivots, highPivots, config));
    results.push(...this.detectDoubleBottom(candles, lowPivots, highPivots, config));
    results.push(...this.detectTripleBottom(candles, lowPivots, highPivots, config));

    return results;
  }

  // ── Head & Shoulders ──────────────────────────────────────────────────────

  private detectHeadAndShoulders(
    candles: OHLCV[],
    highs: PivotPoint[],
    lows: PivotPoint[],
    config: ReversalPatternConfig,
  ): DetectionResult[] {
    if (highs.length < 3) return [];
    const results: DetectionResult[] = [];

    // Try every combination of 3 consecutive high pivots as LS, Head, RS
    for (let i = 0; i < highs.length - 2; i++) {
      const ls = highs[i];
      const head = highs[i + 1];
      const rs = highs[i + 2];

      // Head must be higher than both shoulders
      if (head.price <= ls.price || head.price <= rs.price) continue;

      const headHeight = head.price - Math.max(ls.price, rs.price);
      if (headHeight / head.price < config.headHeightMinFraction) continue;

      // Shoulder symmetry
      const shoulderDiff = Math.abs(ls.price - rs.price) / Math.max(ls.price, rs.price);
      if (shoulderDiff > config.shoulderSymmetryTolerance) continue;

      // Find troughs between LS-Head and Head-RS
      const leftTrough = this.findTroughBetween(lows, ls.index, head.index);
      const rightTrough = this.findTroughBetween(lows, head.index, rs.index);
      if (!leftTrough || !rightTrough) continue;

      // Fit neckline through the two troughs
      const neckline = ShapeMatcher.fitTrendLine([leftTrough, rightTrough], candles, 0.01);
      if (!neckline) continue;

      const necklineRelSlope = ShapeMatcher.relativeSlopePerBar(neckline);
      if (Math.abs(necklineRelSlope) > config.necklineSlopeMax) continue;

      // Symmetry score
      const symmetry = ShapeMatcher.headAndShouldersSymmetry(ls, head, rs, leftTrough, rightTrough);

      const { min, max } = ImageProcessor.priceRange(candles.slice(ls.index, rs.index + 1));
      const patternHeight = max - min;
      const endIdx = rs.index;
      const necklineBreak = ShapeMatcher.priceOnLine(neckline, endIdx);

      const confidence = Math.min(0.93, 0.60 + symmetry * 0.25 + (1 - shoulderDiff / config.shoulderSymmetryTolerance) * 0.08);

      results.push({
        patternType: PatternType.HEAD_AND_SHOULDERS,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BEARISH,
        timeframe: this.classifyTimeframe(rs.index - ls.index),
        confidence,
        startIndex: ls.index,
        endIndex: endIdx,
        startDate: candles[ls.index].timestamp,
        endDate: candles[endIdx].timestamp,
        geometry: {
          pivots: [ls, leftTrough, head, rightTrough, rs],
          neckline,
          keyLevels: [],
          patternHeight,
          patternWidth: rs.index - ls.index,
          symmetryScore: symmetry,
        },
        breakoutLevel: necklineBreak,
        priceTarget: ShapeMatcher.measuredMoveTarget(necklineBreak, patternHeight, false),
        stopLoss: head.price * 1.005,
        description: `Head & Shoulders: bearish reversal. Head at ${head.price.toFixed(4)}, neckline at ${necklineBreak.toFixed(4)}.`,
        metadata: {
          leftShoulderPrice: ls.price,
          headPrice: head.price,
          rightShoulderPrice: rs.price,
          necklineSlope: necklineRelSlope,
          shoulderSymmetry: 1 - shoulderDiff,
        },
      });
    }

    return results;
  }

  private detectInverseHeadAndShoulders(
    candles: OHLCV[],
    lows: PivotPoint[],
    highs: PivotPoint[],
    config: ReversalPatternConfig,
  ): DetectionResult[] {
    if (lows.length < 3) return [];
    const results: DetectionResult[] = [];

    for (let i = 0; i < lows.length - 2; i++) {
      const ls = lows[i];
      const head = lows[i + 1];  // head = lowest point
      const rs = lows[i + 2];

      if (head.price >= ls.price || head.price >= rs.price) continue;

      const headDepth = Math.min(ls.price, rs.price) - head.price;
      if (headDepth / Math.max(ls.price, rs.price) < config.headHeightMinFraction) continue;

      const shoulderDiff = Math.abs(ls.price - rs.price) / Math.max(ls.price, rs.price);
      if (shoulderDiff > config.shoulderSymmetryTolerance) continue;

      const leftPeak = this.findPeakBetween(highs, ls.index, head.index);
      const rightPeak = this.findPeakBetween(highs, head.index, rs.index);
      if (!leftPeak || !rightPeak) continue;

      const neckline = ShapeMatcher.fitTrendLine([leftPeak, rightPeak], candles, 0.01);
      if (!neckline) continue;

      const necklineRelSlope = ShapeMatcher.relativeSlopePerBar(neckline);
      if (Math.abs(necklineRelSlope) > config.necklineSlopeMax) continue;

      const symmetry = ShapeMatcher.headAndShouldersSymmetry(ls, head, rs, leftPeak, rightPeak);
      const { min, max } = ImageProcessor.priceRange(candles.slice(ls.index, rs.index + 1));
      const patternHeight = max - min;
      const endIdx = rs.index;
      const necklineBreak = ShapeMatcher.priceOnLine(neckline, endIdx);
      const confidence = Math.min(0.93, 0.60 + symmetry * 0.25 + (1 - shoulderDiff / config.shoulderSymmetryTolerance) * 0.08);

      results.push({
        patternType: PatternType.INVERSE_HEAD_AND_SHOULDERS,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BULLISH,
        timeframe: this.classifyTimeframe(rs.index - ls.index),
        confidence,
        startIndex: ls.index,
        endIndex: endIdx,
        startDate: candles[ls.index].timestamp,
        endDate: candles[endIdx].timestamp,
        geometry: {
          pivots: [ls, leftPeak, head, rightPeak, rs],
          neckline,
          keyLevels: [],
          patternHeight,
          patternWidth: rs.index - ls.index,
          symmetryScore: symmetry,
        },
        breakoutLevel: necklineBreak,
        priceTarget: ShapeMatcher.measuredMoveTarget(necklineBreak, patternHeight, true),
        stopLoss: head.price * 0.995,
        description: `Inverse H&S: bullish reversal. Head at ${head.price.toFixed(4)}, neckline at ${necklineBreak.toFixed(4)}.`,
        metadata: { headPrice: head.price, necklineSlope: necklineRelSlope, symmetry },
      });
    }

    return results;
  }

  // ── Double Top / Bottom ───────────────────────────────────────────────────

  private detectDoubleTop(
    candles: OHLCV[],
    highs: PivotPoint[],
    lows: PivotPoint[],
    config: ReversalPatternConfig,
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (let i = 0; i < highs.length - 1; i++) {
      const peak1 = highs[i];
      const peak2 = highs[i + 1];

      if (peak2.index - peak1.index < 5) continue;

      const priceDiff = Math.abs(peak1.price - peak2.price) / Math.max(peak1.price, peak2.price);
      if (priceDiff > config.doubleTopTolerance) continue;

      const trough = this.findTroughBetween(lows, peak1.index, peak2.index);
      if (!trough) continue;

      const { min, max } = ImageProcessor.priceRange(candles.slice(peak1.index, peak2.index + 1));
      const patternHeight = max - min;
      const necklinePrice = trough.price;
      const symmetry = 1 - priceDiff / config.doubleTopTolerance;
      const confidence = Math.min(0.88, 0.62 + symmetry * 0.18);

      results.push({
        patternType: PatternType.DOUBLE_TOP,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BEARISH,
        timeframe: this.classifyTimeframe(peak2.index - peak1.index),
        confidence,
        startIndex: peak1.index,
        endIndex: peak2.index,
        startDate: candles[peak1.index].timestamp,
        endDate: candles[peak2.index].timestamp,
        geometry: {
          pivots: [peak1, trough, peak2],
          keyLevels: [{ price: necklinePrice, touches: 1, strength: 0.8, type: 'SUPPORT', firstSeen: trough.timestamp, lastSeen: trough.timestamp }],
          patternHeight,
          patternWidth: peak2.index - peak1.index,
          symmetryScore: symmetry,
        },
        breakoutLevel: necklinePrice,
        priceTarget: ShapeMatcher.measuredMoveTarget(necklinePrice, patternHeight, false),
        stopLoss: Math.max(peak1.price, peak2.price) * 1.01,
        description: `Double Top: two peaks at ~${((peak1.price + peak2.price) / 2).toFixed(4)}, neckline ${necklinePrice.toFixed(4)}.`,
        metadata: { peak1Price: peak1.price, peak2Price: peak2.price, priceDiff, necklinePrice },
      });
    }

    return results;
  }

  private detectDoubleBottom(
    candles: OHLCV[],
    lows: PivotPoint[],
    highs: PivotPoint[],
    config: ReversalPatternConfig,
  ): DetectionResult[] {
    const results: DetectionResult[] = [];

    for (let i = 0; i < lows.length - 1; i++) {
      const trough1 = lows[i];
      const trough2 = lows[i + 1];

      if (trough2.index - trough1.index < 5) continue;

      const priceDiff = Math.abs(trough1.price - trough2.price) / Math.max(trough1.price, trough2.price);
      if (priceDiff > config.doubleTopTolerance) continue;

      const peak = this.findPeakBetween(highs, trough1.index, trough2.index);
      if (!peak) continue;

      const { min, max } = ImageProcessor.priceRange(candles.slice(trough1.index, trough2.index + 1));
      const patternHeight = max - min;
      const necklinePrice = peak.price;
      const symmetry = 1 - priceDiff / config.doubleTopTolerance;
      const confidence = Math.min(0.88, 0.62 + symmetry * 0.18);

      results.push({
        patternType: PatternType.DOUBLE_BOTTOM,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BULLISH,
        timeframe: this.classifyTimeframe(trough2.index - trough1.index),
        confidence,
        startIndex: trough1.index,
        endIndex: trough2.index,
        startDate: candles[trough1.index].timestamp,
        endDate: candles[trough2.index].timestamp,
        geometry: {
          pivots: [trough1, peak, trough2],
          keyLevels: [{ price: necklinePrice, touches: 1, strength: 0.8, type: 'RESISTANCE', firstSeen: peak.timestamp, lastSeen: peak.timestamp }],
          patternHeight,
          patternWidth: trough2.index - trough1.index,
          symmetryScore: symmetry,
        },
        breakoutLevel: necklinePrice,
        priceTarget: ShapeMatcher.measuredMoveTarget(necklinePrice, patternHeight, true),
        stopLoss: Math.min(trough1.price, trough2.price) * 0.99,
        description: `Double Bottom: two troughs at ~${((trough1.price + trough2.price) / 2).toFixed(4)}, neckline ${necklinePrice.toFixed(4)}.`,
        metadata: { trough1Price: trough1.price, trough2Price: trough2.price, priceDiff, necklinePrice },
      });
    }

    return results;
  }

  // ── Triple Top / Bottom ───────────────────────────────────────────────────

  private detectTripleTop(
    candles: OHLCV[],
    highs: PivotPoint[],
    lows: PivotPoint[],
    config: ReversalPatternConfig,
  ): DetectionResult[] {
    if (highs.length < 3) return [];
    const results: DetectionResult[] = [];

    for (let i = 0; i < highs.length - 2; i++) {
      const p1 = highs[i];
      const p2 = highs[i + 1];
      const p3 = highs[i + 2];

      if (p2.index - p1.index < 4 || p3.index - p2.index < 4) continue;

      const diff12 = Math.abs(p1.price - p2.price) / Math.max(p1.price, p2.price);
      const diff23 = Math.abs(p2.price - p3.price) / Math.max(p2.price, p3.price);
      if (diff12 > config.doubleTopTolerance || diff23 > config.doubleTopTolerance) continue;

      const t1 = this.findTroughBetween(lows, p1.index, p2.index);
      const t2 = this.findTroughBetween(lows, p2.index, p3.index);
      if (!t1 || !t2) continue;

      const necklinePrice = (t1.price + t2.price) / 2;
      const { min, max } = ImageProcessor.priceRange(candles.slice(p1.index, p3.index + 1));
      const patternHeight = max - min;
      const symmetry = 1 - (diff12 + diff23) / 2 / config.doubleTopTolerance;
      const confidence = Math.min(0.90, 0.65 + symmetry * 0.20);

      results.push({
        patternType: PatternType.TRIPLE_TOP,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BEARISH,
        timeframe: this.classifyTimeframe(p3.index - p1.index),
        confidence,
        startIndex: p1.index,
        endIndex: p3.index,
        startDate: candles[p1.index].timestamp,
        endDate: candles[p3.index].timestamp,
        geometry: { pivots: [p1, t1, p2, t2, p3], keyLevels: [], patternHeight, patternWidth: p3.index - p1.index, symmetryScore: symmetry },
        breakoutLevel: necklinePrice,
        priceTarget: ShapeMatcher.measuredMoveTarget(necklinePrice, patternHeight, false),
        stopLoss: Math.max(p1.price, p2.price, p3.price) * 1.01,
        description: `Triple Top: bearish reversal; three peaks at ~${((p1.price + p2.price + p3.price) / 3).toFixed(4)}.`,
        metadata: { avgPeakPrice: (p1.price + p2.price + p3.price) / 3, necklinePrice },
      });
    }

    return results;
  }

  private detectTripleBottom(
    candles: OHLCV[],
    lows: PivotPoint[],
    highs: PivotPoint[],
    config: ReversalPatternConfig,
  ): DetectionResult[] {
    if (lows.length < 3) return [];
    const results: DetectionResult[] = [];

    for (let i = 0; i < lows.length - 2; i++) {
      const t1 = lows[i];
      const t2 = lows[i + 1];
      const t3 = lows[i + 2];

      if (t2.index - t1.index < 4 || t3.index - t2.index < 4) continue;

      const diff12 = Math.abs(t1.price - t2.price) / Math.max(t1.price, t2.price);
      const diff23 = Math.abs(t2.price - t3.price) / Math.max(t2.price, t3.price);
      if (diff12 > config.doubleTopTolerance || diff23 > config.doubleTopTolerance) continue;

      const p1 = this.findPeakBetween(highs, t1.index, t2.index);
      const p2 = this.findPeakBetween(highs, t2.index, t3.index);
      if (!p1 || !p2) continue;

      const necklinePrice = (p1.price + p2.price) / 2;
      const { min, max } = ImageProcessor.priceRange(candles.slice(t1.index, t3.index + 1));
      const patternHeight = max - min;
      const symmetry = 1 - (diff12 + diff23) / 2 / config.doubleTopTolerance;
      const confidence = Math.min(0.90, 0.65 + symmetry * 0.20);

      results.push({
        patternType: PatternType.TRIPLE_BOTTOM,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BULLISH,
        timeframe: this.classifyTimeframe(t3.index - t1.index),
        confidence,
        startIndex: t1.index,
        endIndex: t3.index,
        startDate: candles[t1.index].timestamp,
        endDate: candles[t3.index].timestamp,
        geometry: { pivots: [t1, p1, t2, p2, t3], keyLevels: [], patternHeight, patternWidth: t3.index - t1.index, symmetryScore: symmetry },
        breakoutLevel: necklinePrice,
        priceTarget: ShapeMatcher.measuredMoveTarget(necklinePrice, patternHeight, true),
        stopLoss: Math.min(t1.price, t2.price, t3.price) * 0.99,
        description: `Triple Bottom: bullish reversal; three troughs at ~${((t1.price + t2.price + t3.price) / 3).toFixed(4)}.`,
        metadata: { avgTroughPrice: (t1.price + t2.price + t3.price) / 3, necklinePrice },
      });
    }

    return results;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private findTroughBetween(lows: PivotPoint[], startIdx: number, endIdx: number): PivotPoint | null {
    const between = lows.filter((p) => p.index > startIdx && p.index < endIdx);
    if (between.length === 0) return null;
    return between.reduce((min, p) => p.price < min.price ? p : min);
  }

  private findPeakBetween(highs: PivotPoint[], startIdx: number, endIdx: number): PivotPoint | null {
    const between = highs.filter((p) => p.index > startIdx && p.index < endIdx);
    if (between.length === 0) return null;
    return between.reduce((max, p) => p.price > max.price ? p : max);
  }

  private classifyTimeframe(bars: number): PatternTimeframe {
    if (bars <= 20) return PatternTimeframe.SHORT;
    if (bars <= 60) return PatternTimeframe.MEDIUM;
    return PatternTimeframe.LONG;
  }
}
