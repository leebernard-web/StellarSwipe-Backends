export enum PatternType {
  // ── Candlestick ────────────────────────────────────────────────────────────
  DOJI = 'DOJI',
  HAMMER = 'HAMMER',
  INVERTED_HAMMER = 'INVERTED_HAMMER',
  SHOOTING_STAR = 'SHOOTING_STAR',
  HANGING_MAN = 'HANGING_MAN',
  BULLISH_ENGULFING = 'BULLISH_ENGULFING',
  BEARISH_ENGULFING = 'BEARISH_ENGULFING',
  MORNING_STAR = 'MORNING_STAR',
  EVENING_STAR = 'EVENING_STAR',
  HARAMI_BULLISH = 'HARAMI_BULLISH',
  HARAMI_BEARISH = 'HARAMI_BEARISH',
  THREE_WHITE_SOLDIERS = 'THREE_WHITE_SOLDIERS',
  THREE_BLACK_CROWS = 'THREE_BLACK_CROWS',

  // ── Trend ──────────────────────────────────────────────────────────────────
  UPTREND_CHANNEL = 'UPTREND_CHANNEL',
  DOWNTREND_CHANNEL = 'DOWNTREND_CHANNEL',
  HORIZONTAL_CHANNEL = 'HORIZONTAL_CHANNEL',

  // ── Reversal ───────────────────────────────────────────────────────────────
  HEAD_AND_SHOULDERS = 'HEAD_AND_SHOULDERS',
  INVERSE_HEAD_AND_SHOULDERS = 'INVERSE_HEAD_AND_SHOULDERS',
  DOUBLE_TOP = 'DOUBLE_TOP',
  DOUBLE_BOTTOM = 'DOUBLE_BOTTOM',
  TRIPLE_TOP = 'TRIPLE_TOP',
  TRIPLE_BOTTOM = 'TRIPLE_BOTTOM',

  // ── Consolidation ──────────────────────────────────────────────────────────
  ASCENDING_TRIANGLE = 'ASCENDING_TRIANGLE',
  DESCENDING_TRIANGLE = 'DESCENDING_TRIANGLE',
  SYMMETRIC_TRIANGLE = 'SYMMETRIC_TRIANGLE',
  RECTANGLE = 'RECTANGLE',
  FLAG_BULL = 'FLAG_BULL',
  FLAG_BEAR = 'FLAG_BEAR',
  PENNANT = 'PENNANT',
  RISING_WEDGE = 'RISING_WEDGE',
  FALLING_WEDGE = 'FALLING_WEDGE',

  // ── Support / Resistance ───────────────────────────────────────────────────
  SUPPORT_LEVEL = 'SUPPORT_LEVEL',
  RESISTANCE_LEVEL = 'RESISTANCE_LEVEL',
}

export enum PatternDirection {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

export enum PatternCategory {
  CANDLESTICK = 'CANDLESTICK',
  TREND = 'TREND',
  REVERSAL = 'REVERSAL',
  CONSOLIDATION = 'CONSOLIDATION',
  SUPPORT_RESISTANCE = 'SUPPORT_RESISTANCE',
}

export enum PatternTimeframe {
  MICRO = 'MICRO',    // 1–4 candles  (candlestick patterns)
  SHORT = 'SHORT',    // 5–20 candles
  MEDIUM = 'MEDIUM',  // 21–60 candles
  LONG = 'LONG',      // 61+ candles
}

// ── Core data structures ────────────────────────────────────────────────────

/**
 * Open-High-Low-Close-Volume candle with a UTC timestamp.
 * All price fields are raw (unscaled) decimal values.
 */
export interface OHLCV {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * A locally extreme price point confirmed by `strength` bars on each side.
 */
export interface PivotPoint {
  index: number;           // Position in the OHLCV array
  price: number;           // Pivot price (high for HIGH pivots, low for LOW)
  timestamp: Date;
  type: 'HIGH' | 'LOW';
  strength: number;        // 0-1, prominence relative to surrounding range
}

/**
 * A linear trend line fitted through a set of price pivots.
 */
export interface TrendLine {
  slope: number;           // Price change per bar index
  intercept: number;       // Estimated price at index 0
  r2: number;              // Coefficient of determination (0-1 fit quality)
  startIndex: number;
  endIndex: number;
  startPrice: number;      // Projected price at startIndex
  endPrice: number;        // Projected price at endIndex
  touches: number;         // Confirmed touches within tolerance
}

/**
 * A horizontal support or resistance price cluster.
 */
export interface SupportResistanceLevel {
  price: number;
  touches: number;
  strength: number;        // 0-1
  type: 'SUPPORT' | 'RESISTANCE';
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * The geometric description of a detected pattern.
 */
export interface PatternGeometry {
  pivots: PivotPoint[];
  upperTrendLine?: TrendLine;
  lowerTrendLine?: TrendLine;
  neckline?: TrendLine;
  keyLevels: SupportResistanceLevel[];
  patternHeight: number;    // Total price range of pattern
  patternWidth: number;     // Candle span
  symmetryScore: number;    // 0-1, geometric symmetry
}

/**
 * The output of a single detector pass.
 */
export interface DetectionResult {
  patternType: PatternType;
  category: PatternCategory;
  direction: PatternDirection;
  timeframe: PatternTimeframe;
  confidence: number;          // 0-1
  startIndex: number;
  endIndex: number;
  startDate: Date;
  endDate: Date;
  geometry: PatternGeometry;
  priceTarget?: number;        // Projected price after breakout
  stopLoss?: number;           // Suggested stop level
  breakoutLevel?: number;      // Level that confirms the pattern
  description: string;
  metadata: Record<string, unknown>;
}
