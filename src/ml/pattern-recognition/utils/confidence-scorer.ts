import { OHLCV, DetectionResult, PatternCategory } from '../interfaces/pattern.interface';
import { ImageProcessor } from './image-processor';
import { ShapeMatcher } from './shape-matcher';

export interface ConfidenceFactors {
  /** How well the geometry fits the ideal pattern template (0-1) */
  geometricFit: number;
  /** Volume behaviour supports the pattern (0-1) */
  volumeConfirmation: number;
  /** Trend line / regression quality (0-1) */
  trendLineQuality: number;
  /** Symmetry of the pattern structure (0-1) */
  symmetry: number;
  /** Historical success rate of this pattern type on this asset (0-1, 0.5 default) */
  historicalAccuracy: number;
  /** RSI alignment with expected direction (0-1) */
  momentumAlignment: number;
  /** Number of confirmed pivot touches normalised to [0,1] */
  touchCount: number;
}

/**
 * ConfidenceScorer produces a single 0-1 confidence value for a detected
 * pattern by weighting multiple independent evidence factors.
 *
 * Each factor is evaluated in isolation; the final score is a weighted sum,
 * clipped to [0, 1].  Weights are calibrated so that strong geometric evidence
 * with average volume and momentum alignment yields ~0.65.
 */
export class ConfidenceScorer {

  private static readonly WEIGHTS: Record<keyof ConfidenceFactors, number> = {
    geometricFit: 0.30,
    volumeConfirmation: 0.15,
    trendLineQuality: 0.20,
    symmetry: 0.15,
    historicalAccuracy: 0.05,
    momentumAlignment: 0.10,
    touchCount: 0.05,
  };

  /**
   * Computes the final weighted confidence score.
   */
  static compute(factors: ConfidenceFactors): number {
    const w = this.WEIGHTS;
    const raw =
      factors.geometricFit * w.geometricFit +
      factors.volumeConfirmation * w.volumeConfirmation +
      factors.trendLineQuality * w.trendLineQuality +
      factors.symmetry * w.symmetry +
      factors.historicalAccuracy * w.historicalAccuracy +
      factors.momentumAlignment * w.momentumAlignment +
      factors.touchCount * w.touchCount;

    return Math.max(0, Math.min(1, raw));
  }

  /**
   * Evaluates the volume factor: consolidation patterns expect volume to
   * contract; breakout and candlestick patterns expect a volume surge.
   *
   * @param candles      The candle window for the pattern.
   * @param category     The category drives what "good" volume looks like.
   */
  static volumeConfirmation(candles: OHLCV[], category: PatternCategory): number {
    if (candles.length < 4) return 0.5;

    const declining = ImageProcessor.isVolumeDeclining(candles, 0.7);
    const lastVol = candles.slice(-3).reduce((s, c) => s + c.volume, 0) / 3;
    const avgVol = candles.reduce((s, c) => s + c.volume, 0) / candles.length;
    const volRatio = avgVol === 0 ? 1 : lastVol / avgVol;

    switch (category) {
      case PatternCategory.CONSOLIDATION:
        // Good: volume contracts during consolidation
        return declining ? 0.85 : 0.4;

      case PatternCategory.REVERSAL:
        // Good: volume spike at the reversal candle
        return Math.min(1, 0.3 + (volRatio - 1) * 0.5);

      case PatternCategory.CANDLESTICK:
        // Good: the signal candle has above-average volume
        return Math.min(1, Math.max(0.2, 0.3 + volRatio * 0.3));

      case PatternCategory.TREND:
        // Trend is stronger when volume expands in the trend direction
        return Math.min(1, 0.4 + (volRatio - 0.8) * 0.4);

      default:
        return 0.5;
    }
  }

  /**
   * Evaluates trend-line quality from the R² of OLS regressions.
   * If both upper and lower lines are available, averages them.
   */
  static trendLineQuality(r2Upper?: number, r2Lower?: number): number {
    const values = [r2Upper, r2Lower].filter((v): v is number => v !== undefined);
    if (values.length === 0) return 0.5;
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    // Map R² ∈ [0,1] → confidence ∈ [0,1] with a soft scaling
    return Math.min(1, avg * 1.1);
  }

  /**
   * Evaluates how many touches the trend lines received.
   * More touches = stronger pattern confirmation.
   *
   * @param touches    Total touch count across all trend lines.
   * @param maxTouches Normalisation ceiling (default 10).
   */
  static touchCountScore(touches: number, maxTouches = 10): number {
    return Math.min(1, touches / maxTouches);
  }

  /**
   * Evaluates RSI alignment with the expected pattern direction.
   *
   * Bullish patterns: RSI should be below 50 (room to rally) — not overbought.
   * Bearish patterns: RSI should be above 50 (room to fall) — not oversold.
   * Neutral patterns: close to 50 is ideal.
   *
   * @param rsi         RSI normalised to [0,1].
   * @param isBullish   Expected direction.
   * @param isNeutral   Pattern has no directional bias.
   */
  static momentumAlignment(rsi: number, isBullish: boolean, isNeutral = false): number {
    if (isNeutral) {
      // Score highest when RSI is near 0.5
      return 1 - Math.abs(rsi - 0.5) * 2;
    }
    if (isBullish) {
      // Good: RSI < 0.5 (oversold / neutral); penalise overbought (RSI > 0.7)
      if (rsi <= 0.5) return 0.8 + (0.5 - rsi) * 0.4;
      return Math.max(0, 0.8 - (rsi - 0.5) * 2);
    }
    // Bearish: RSI > 0.5 is good
    if (rsi >= 0.5) return 0.8 + (rsi - 0.5) * 0.4;
    return Math.max(0, 0.8 - (0.5 - rsi) * 2);
  }

  /**
   * Computes all confidence factors for a result in one pass.
   * Used by the ChartAnalyzerService to score DetectionResults uniformly.
   */
  static scoreResult(
    result: DetectionResult,
    candles: OHLCV[],
    historicalAccuracy = 0.5,
  ): number {
    const slice = candles.slice(result.startIndex, result.endIndex + 1);
    const rsi = ImageProcessor.rsi(slice);

    const isBullish = result.direction === 'BULLISH' as any;
    const isNeutral = result.direction === 'NEUTRAL' as any;

    const r2Upper = result.geometry.upperTrendLine?.r2;
    const r2Lower = result.geometry.lowerTrendLine?.r2;
    const totalTouches =
      (result.geometry.upperTrendLine?.touches ?? 0) +
      (result.geometry.lowerTrendLine?.touches ?? 0);

    const factors: ConfidenceFactors = {
      geometricFit: result.confidence,                          // Raw detector quality
      volumeConfirmation: this.volumeConfirmation(slice, result.category),
      trendLineQuality: this.trendLineQuality(r2Upper, r2Lower),
      symmetry: result.geometry.symmetryScore,
      historicalAccuracy,
      momentumAlignment: this.momentumAlignment(rsi, isBullish, isNeutral),
      touchCount: this.touchCountScore(totalTouches),
    };

    return this.compute(factors);
  }

  /**
   * Adjusts an existing confidence value by a penalty for a single failed factor.
   * Useful for iterative quality checks in detectors.
   *
   * @param current    Current confidence (0-1).
   * @param penalty    Fractional penalty to apply (e.g. 0.15 = subtract 15%).
   */
  static applyPenalty(current: number, penalty: number): number {
    return Math.max(0, current - penalty);
  }

  /**
   * Applies a bonus for exceptional pattern quality.
   * Caps at 0.97 to keep room for imperfect real-world data.
   */
  static applyBonus(current: number, bonus: number): number {
    return Math.min(0.97, current + bonus);
  }
}
