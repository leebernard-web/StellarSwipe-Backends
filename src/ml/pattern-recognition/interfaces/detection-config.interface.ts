export interface CandlestickConfig {
  /** Max body/total-range ratio for a candle to be classified as Doji (default 0.10) */
  dojiBodyThreshold: number;
  /** Min lower-wick/body ratio for Hammer detection (default 2.0) */
  hammerWickRatio: number;
  /** Min upper-wick/body ratio for Shooting Star (default 2.0) */
  shootingStarWickRatio: number;
  /** The engulfing candle must be at least this multiple of the prior body (default 1.0) */
  engulfingMultiple: number;
  /** Min body size as fraction of ATR to avoid noise candles (default 0.3) */
  minBodyAtrFraction: number;
}

export interface TrendPatternConfig {
  /** Minimum candles in lookback window to fit a trend (default 5) */
  minCandles: number;
  /** Maximum candles to include in a single trend segment (default 100) */
  maxCandles: number;
  /** Minimum R² for a trend line to be considered valid (default 0.70) */
  r2Threshold: number;
  /** Minimum |slope / mean-price| before a channel is considered trending vs. horizontal (default 0.001) */
  slopeThreshold: number;
  /** A pivot is "touching" the trend line if within this fraction of the ATR (default 0.02) */
  touchTolerance: number;
  /** Minimum channel width as fraction of price to filter noise (default 0.005) */
  minChannelWidthFraction: number;
}

export interface ReversalPatternConfig {
  /** Max relative difference between two shoulders in H&S (default 0.05 = 5%) */
  shoulderSymmetryTolerance: number;
  /** Max |slope / mean-price| for the neckline to be considered flat (default 0.05) */
  necklineSlopeMax: number;
  /** Min total bars spanned by the pattern (default 10) */
  minPatternBars: number;
  /** Max relative price difference between the two tops/bottoms in Double Top/Bottom (default 0.03) */
  doubleTopTolerance: number;
  /** Min relative height of the head above shoulders in H&S (default 0.02) */
  headHeightMinFraction: number;
}

export interface ConsolidationPatternConfig {
  /** Min bars before the triangle apex (default 8) */
  minConvergenceBars: number;
  /** Apex must be at most this multiple of the pattern width ahead (default 2.0) */
  maxApexFraction: number;
  /** Expected volume decline from start to end of consolidation (default 0.60 = 40% drop) */
  volumeDeclineFactor: number;
  /** Max allowed slope magnitude for the "flat" side of asymmetric triangles (default 0.001) */
  flatSlopeTolerance: number;
}

export interface SupportResistanceConfig {
  /** Half-width of the price cluster band, as fraction of price (default 0.015 = 1.5%) */
  touchTolerance: number;
  /** Minimum touches required to confirm a level (default 3) */
  minTouches: number;
  /** How many candles to look back (default 100) */
  lookback: number;
  /** Maximum number of levels to return (default 10) */
  maxLevels: number;
}

export interface DetectionConfig {
  candlestick: CandlestickConfig;
  trend: TrendPatternConfig;
  reversal: ReversalPatternConfig;
  consolidation: ConsolidationPatternConfig;
  supportResistance: SupportResistanceConfig;
  /** Detections below this confidence are discarded (default 0.45) */
  minConfidence: number;
  /** Number of bars on each side required to confirm a pivot point (default 3) */
  pivotStrength: number;
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  candlestick: {
    dojiBodyThreshold: 0.10,
    hammerWickRatio: 2.0,
    shootingStarWickRatio: 2.0,
    engulfingMultiple: 1.0,
    minBodyAtrFraction: 0.3,
  },
  trend: {
    minCandles: 5,
    maxCandles: 100,
    r2Threshold: 0.70,
    slopeThreshold: 0.001,
    touchTolerance: 0.02,
    minChannelWidthFraction: 0.005,
  },
  reversal: {
    shoulderSymmetryTolerance: 0.05,
    necklineSlopeMax: 0.05,
    minPatternBars: 10,
    doubleTopTolerance: 0.03,
    headHeightMinFraction: 0.02,
  },
  consolidation: {
    minConvergenceBars: 8,
    maxApexFraction: 2.0,
    volumeDeclineFactor: 0.60,
    flatSlopeTolerance: 0.001,
  },
  supportResistance: {
    touchTolerance: 0.015,
    minTouches: 3,
    lookback: 100,
    maxLevels: 10,
  },
  minConfidence: 0.45,
  pivotStrength: 3,
};
