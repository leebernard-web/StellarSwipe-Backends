import { OHLCV, PivotPoint, TrendLine, SupportResistanceLevel } from '../interfaces/pattern.interface';

/**
 * ShapeMatcher provides geometric and statistical primitives for fitting
 * trend lines, detecting support/resistance clusters, and measuring the
 * similarity between a detected price shape and idealised pattern templates.
 *
 * All algorithms are implemented in pure TypeScript — no external libraries.
 */
export class ShapeMatcher {

  // ── Linear regression / trend lines ─────────────────────────────────────

  /**
   * Fits an Ordinary Least Squares regression line through (index, price) pairs.
   * Returns slope, intercept, and R² goodness-of-fit.
   */
  static linearRegression(points: Array<{ x: number; y: number }>): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = points.length;
    if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };

    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
    const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

    return { slope, intercept, r2 };
  }

  /**
   * Builds a TrendLine through a list of pivot points using OLS regression.
   *
   * @param pivots  Pivot points to fit (all of the same type: HIGH or LOW).
   * @param candles Full OHLCV series (used for touch counting).
   * @param tolerance  Fraction of ATR within which a candle counts as "touching".
   */
  static fitTrendLine(
    pivots: PivotPoint[],
    candles: OHLCV[],
    tolerance = 0.02,
  ): TrendLine | null {
    if (pivots.length < 2) return null;

    const points = pivots.map((p) => ({ x: p.index, y: p.price }));
    const { slope, intercept, r2 } = this.linearRegression(points);

    const startIndex = pivots[0].index;
    const endIndex = pivots[pivots.length - 1].index;
    const startPrice = slope * startIndex + intercept;
    const endPrice = slope * endIndex + intercept;

    // Count how many candles come within tolerance of the line
    const priceRange = Math.abs(endPrice - startPrice) || 1;
    let touches = 0;

    for (let i = startIndex; i <= endIndex && i < candles.length; i++) {
      const linePrice = slope * i + intercept;
      const delta = Math.abs(candles[i].close - linePrice) / linePrice;
      if (delta <= tolerance) touches++;
    }

    return { slope, intercept, r2, startIndex, endIndex, startPrice, endPrice, touches };
  }

  /**
   * Returns the price on a trend line at a given bar index.
   */
  static priceOnLine(line: TrendLine, index: number): number {
    return line.slope * index + line.intercept;
  }

  /**
   * Computes the angle (degrees) of a trend line relative to horizontal.
   * Positive = upward, negative = downward.
   */
  static lineAngleDegrees(line: TrendLine, barWidth: number): number {
    return Math.atan(line.slope / barWidth) * (180 / Math.PI);
  }

  // ── Support / Resistance clustering ─────────────────────────────────────

  /**
   * Identifies horizontal support and resistance levels by clustering pivot
   * prices that repeatedly appear within `tolerance * price` of each other.
   *
   * Algorithm:
   *  1. Collect all pivot prices.
   *  2. Sort and merge prices within the tolerance band into clusters.
   *  3. Rank clusters by touch count × recency weight.
   */
  static findSupportResistanceLevels(
    pivots: PivotPoint[],
    tolerance = 0.015,
    minTouches = 3,
    maxLevels = 10,
  ): SupportResistanceLevel[] {
    if (pivots.length === 0) return [];

    // Separate highs and lows
    const highPivots = pivots.filter((p) => p.type === 'HIGH');
    const lowPivots = pivots.filter((p) => p.type === 'LOW');

    const resistanceLevels = this.clusterPivots(highPivots, tolerance, minTouches, 'RESISTANCE');
    const supportLevels = this.clusterPivots(lowPivots, tolerance, minTouches, 'SUPPORT');

    return [...resistanceLevels, ...supportLevels]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, maxLevels);
  }

  private static clusterPivots(
    pivots: PivotPoint[],
    tolerance: number,
    minTouches: number,
    type: 'SUPPORT' | 'RESISTANCE',
  ): SupportResistanceLevel[] {
    if (pivots.length === 0) return [];

    const sorted = [...pivots].sort((a, b) => a.price - b.price);
    const clusters: PivotPoint[][] = [];
    let current: PivotPoint[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const basePrice = current[0].price;
      if (Math.abs(sorted[i].price - basePrice) / basePrice <= tolerance) {
        current.push(sorted[i]);
      } else {
        clusters.push(current);
        current = [sorted[i]];
      }
    }
    clusters.push(current);

    return clusters
      .filter((c) => c.length >= minTouches)
      .map((c) => {
        const avgPrice = c.reduce((s, p) => s + p.price, 0) / c.length;
        const avgStrength = c.reduce((s, p) => s + p.strength, 0) / c.length;
        const timestamps = c.map((p) => p.timestamp);

        return {
          price: avgPrice,
          touches: c.length,
          strength: Math.min(1, avgStrength * c.length / 5),
          type,
          firstSeen: new Date(Math.min(...timestamps.map((t) => t.getTime()))),
          lastSeen: new Date(Math.max(...timestamps.map((t) => t.getTime()))),
        };
      });
  }

  // ── Pattern geometry / template matching ─────────────────────────────────

  /**
   * Measures how symmetric a Head & Shoulders pattern is.
   *
   * Evaluates:
   *  - Left shoulder ≈ right shoulder (price)
   *  - Left trough ≈ right trough (neckline slope)
   *  - Width symmetry: distance from left shoulder to head vs. head to right shoulder
   *
   * @returns 0 (asymmetric) to 1 (perfectly symmetric)
   */
  static headAndShouldersSymmetry(
    leftShoulder: PivotPoint,
    head: PivotPoint,
    rightShoulder: PivotPoint,
    leftTrough: PivotPoint,
    rightTrough: PivotPoint,
  ): number {
    // Shoulder price symmetry
    const shoulderPriceDiff =
      Math.abs(leftShoulder.price - rightShoulder.price) /
      Math.max(leftShoulder.price, rightShoulder.price);

    // Trough price symmetry
    const troughPriceDiff =
      Math.abs(leftTrough.price - rightTrough.price) /
      Math.max(leftTrough.price, rightTrough.price);

    // Width symmetry: bars from LS→Head vs Head→RS
    const leftWidth = head.index - leftShoulder.index;
    const rightWidth = rightShoulder.index - head.index;
    const widthDiff =
      Math.abs(leftWidth - rightWidth) / Math.max(leftWidth, rightWidth, 1);

    // Combine into 0-1 score (lower diffs = higher score)
    const score = Math.max(
      0,
      1 - (shoulderPriceDiff + troughPriceDiff + widthDiff) / 3,
    );

    return score;
  }

  /**
   * Measures how well two price points match within a given tolerance.
   * Returns 0 (no match) to 1 (exact match).
   */
  static priceMatch(priceA: number, priceB: number, tolerance: number): number {
    const diff = Math.abs(priceA - priceB) / Math.max(priceA, priceB, 1e-8);
    return Math.max(0, 1 - diff / tolerance);
  }

  /**
   * Checks if two trend lines converge (form a triangle apex).
   *
   * @returns Apex bar index (forward-looking) or null if they diverge/are parallel.
   */
  static findConvergencePoint(upper: TrendLine, lower: TrendLine): number | null {
    const slopeDiff = upper.slope - lower.slope;
    if (Math.abs(slopeDiff) < 1e-10) return null; // Parallel

    const interceptDiff = lower.intercept - upper.intercept;
    const x = interceptDiff / slopeDiff;

    return x > upper.endIndex ? Math.round(x) : null;
  }

  /**
   * Pearson correlation coefficient between two equal-length number series.
   */
  static pearsonCorrelation(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;

    const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
    const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

    let cov = 0;
    let varA = 0;
    let varB = 0;

    for (let i = 0; i < n; i++) {
      cov += (a[i] - meanA) * (b[i] - meanB);
      varA += Math.pow(a[i] - meanA, 2);
      varB += Math.pow(b[i] - meanB, 2);
    }

    const denom = Math.sqrt(varA * varB);
    return denom === 0 ? 0 : cov / denom;
  }

  /**
   * Normalised Euclidean distance between two same-length vectors.
   * Returns 0 (identical) to 1 (maximally different).
   */
  static normalisedEuclideanDistance(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 1;

    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += Math.pow(a[i] - b[i], 2);

    return Math.min(1, Math.sqrt(sumSq / n));
  }

  /**
   * Computes the slope of a trend line relative to the mean price level.
   * A small value (~0) indicates a roughly horizontal level.
   */
  static relativeSlopePerBar(line: TrendLine): number {
    const midPrice = (line.startPrice + line.endPrice) / 2;
    return midPrice === 0 ? 0 : line.slope / midPrice;
  }

  /**
   * Returns the breakout level for a pattern given its geometry.
   * For bullish patterns: the upper trend line / neckline.
   * For bearish patterns: the lower trend line / neckline.
   */
  static computeBreakoutLevel(
    upperLine: TrendLine | undefined,
    lowerLine: TrendLine | undefined,
    endIndex: number,
    isBullish: boolean,
  ): number | undefined {
    if (isBullish && upperLine) {
      return this.priceOnLine(upperLine, endIndex);
    }
    if (!isBullish && lowerLine) {
      return this.priceOnLine(lowerLine, endIndex);
    }
    return undefined;
  }

  /**
   * Computes a price projection target using the measured-move technique:
   * the height of the pattern added to the breakout level.
   */
  static measuredMoveTarget(breakoutLevel: number, patternHeight: number, isBullish: boolean): number {
    return isBullish ? breakoutLevel + patternHeight : breakoutLevel - patternHeight;
  }
}
