import { OHLCV, PivotPoint } from '../interfaces/pattern.interface';

/**
 * ImageProcessor converts raw OHLCV data into a normalised coordinate space
 * suitable for geometric pattern matching — analogous to rasterising a price
 * chart into a pixel grid before running computer-vision algorithms.
 *
 * Coordinate system:
 *   x ∈ [0, 1]  →  time (left = oldest, right = newest)
 *   y ∈ [0, 1]  →  price (bottom = min, top = max)
 */
export class ImageProcessor {

  // ── Coordinate normalisation ─────────────────────────────────────────────

  /**
   * Maps the raw candle series to normalised (x, y) close-price coordinates.
   */
  static normalise(candles: OHLCV[]): Array<{ x: number; y: number }> {
    if (candles.length === 0) return [];
    const prices = candles.map((c) => c.close);
    const { min, max } = this.priceRange(candles);
    const range = max - min || 1;
    const n = candles.length - 1 || 1;

    return prices.map((p, i) => ({
      x: i / n,
      y: (p - min) / range,
    }));
  }

  /**
   * Rasterises close prices onto an (cols × rows) grid.
   * Each grid cell is 1 if any close price falls in that (x-bin, y-bin), else 0.
   * Useful for template overlap / cross-correlation scoring.
   */
  static rasterise(candles: OHLCV[], cols = 64, rows = 64): Uint8Array {
    const grid = new Uint8Array(cols * rows);
    if (candles.length === 0) return grid;

    const { min, max } = this.priceRange(candles);
    const range = max - min || 1;
    const n = candles.length;

    for (let i = 0; i < n; i++) {
      const col = Math.min(cols - 1, Math.floor((i / n) * cols));
      const row = Math.min(rows - 1, Math.floor(((candles[i].close - min) / range) * rows));
      // Invert row so high price = top row
      grid[(rows - 1 - row) * cols + col] = 1;
    }

    return grid;
  }

  /**
   * Cross-correlation score (0-1) between two rasterised grids of identical size.
   * Equivalent to template matching: measures how much two patterns overlap.
   */
  static crossCorrelation(a: Uint8Array, b: Uint8Array): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ── Pivot point detection ────────────────────────────────────────────────

  /**
   * Detects local high and low pivot points.
   *
   * A HIGH pivot at index i requires:
   *   candles[i].high > candles[i±k].high  for all k in [1, strength]
   *
   * A LOW pivot at index i requires:
   *   candles[i].low < candles[i±k].low   for all k in [1, strength]
   *
   * @param strength  Number of bars on each side that must be lower/higher.
   */
  static detectPivots(candles: OHLCV[], strength = 3): PivotPoint[] {
    const pivots: PivotPoint[] = [];
    const n = candles.length;
    const { min, max } = this.priceRange(candles);
    const range = max - min || 1;

    for (let i = strength; i < n - strength; i++) {
      const c = candles[i];
      let isHighPivot = true;
      let isLowPivot = true;

      for (let k = 1; k <= strength; k++) {
        if (candles[i - k].high >= c.high || candles[i + k].high >= c.high) isHighPivot = false;
        if (candles[i - k].low <= c.low || candles[i + k].low <= c.low) isLowPivot = false;
        if (!isHighPivot && !isLowPivot) break;
      }

      if (isHighPivot) {
        // Strength = how much higher this high is than the surrounding highs
        const leftHigh = Math.max(...candles.slice(i - strength, i).map((x) => x.high));
        const rightHigh = Math.max(...candles.slice(i + 1, i + strength + 1).map((x) => x.high));
        const prominence = (c.high - Math.max(leftHigh, rightHigh)) / range;

        pivots.push({
          index: i,
          price: c.high,
          timestamp: c.timestamp,
          type: 'HIGH',
          strength: Math.max(0, Math.min(1, prominence * 5)),
        });
      }

      if (isLowPivot) {
        const leftLow = Math.min(...candles.slice(i - strength, i).map((x) => x.low));
        const rightLow = Math.min(...candles.slice(i + 1, i + strength + 1).map((x) => x.low));
        const prominence = (Math.min(leftLow, rightLow) - c.low) / range;

        pivots.push({
          index: i,
          price: c.low,
          timestamp: c.timestamp,
          type: 'LOW',
          strength: Math.max(0, Math.min(1, prominence * 5)),
        });
      }
    }

    return pivots;
  }

  /**
   * Filters pivots to only the N most significant by strength.
   */
  static topPivots(pivots: PivotPoint[], n: number, type?: 'HIGH' | 'LOW'): PivotPoint[] {
    const filtered = type ? pivots.filter((p) => p.type === type) : pivots;
    return [...filtered].sort((a, b) => b.strength - a.strength).slice(0, n);
  }

  // ── Statistical / signal processing helpers ──────────────────────────────

  /**
   * Average True Range over the last `period` candles.
   */
  static atr(candles: OHLCV[], period = 14): number {
    if (candles.length < 2) return 0;
    const trs: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].close;
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - prev),
        Math.abs(candles[i].low - prev),
      );
      trs.push(tr);
    }

    const slice = trs.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  }

  /**
   * Simple Moving Average of close prices.
   */
  static sma(candles: OHLCV[], period: number): number[] {
    const closes = candles.map((c) => c.close);
    const out: number[] = [];
    for (let i = period - 1; i < closes.length; i++) {
      const sum = closes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
      out.push(sum / period);
    }
    return out;
  }

  /**
   * Relative Strength Index (14-period by default), normalised to [0, 1].
   */
  static rsi(candles: OHLCV[], period = 14): number {
    if (candles.length <= period) return 0.5;
    let gains = 0;
    let losses = 0;

    for (let i = candles.length - period; i < candles.length; i++) {
      const delta = candles[i].close - candles[i - 1].close;
      if (delta > 0) gains += delta;
      else losses += Math.abs(delta);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 1;
    const rs = avgGain / avgLoss;
    return (100 - 100 / (1 + rs)) / 100;
  }

  /**
   * Detects if volume is declining through the candle window
   * (front-half average vs. back-half average).
   */
  static isVolumeDeclining(candles: OHLCV[], expectedFactor = 0.6): boolean {
    if (candles.length < 4) return false;
    const mid = Math.floor(candles.length / 2);
    const firstHalf = candles.slice(0, mid).map((c) => c.volume);
    const secondHalf = candles.slice(mid).map((c) => c.volume);
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    return avgFirst > 0 && avgSecond / avgFirst <= expectedFactor;
  }

  /**
   * Returns the price range (min low, max high) for the candle window.
   */
  static priceRange(candles: OHLCV[]): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }

  /**
   * Returns the median price across all close prices in the window.
   */
  static medianClose(candles: OHLCV[]): number {
    if (candles.length === 0) return 0;
    const sorted = [...candles.map((c) => c.close)].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Builds a volume profile: returns price levels with the most volume.
   * Divides the price range into `buckets` equal-width bins.
   */
  static volumeProfile(
    candles: OHLCV[],
    buckets = 20,
  ): Array<{ priceLevel: number; volume: number }> {
    const { min, max } = this.priceRange(candles);
    const range = max - min || 1;
    const bucketSize = range / buckets;
    const profile = new Array(buckets).fill(0);

    for (const c of candles) {
      const bucket = Math.min(buckets - 1, Math.floor((c.close - min) / bucketSize));
      profile[bucket] += c.volume;
    }

    return profile.map((volume, i) => ({
      priceLevel: min + (i + 0.5) * bucketSize,
      volume,
    }));
  }
}
