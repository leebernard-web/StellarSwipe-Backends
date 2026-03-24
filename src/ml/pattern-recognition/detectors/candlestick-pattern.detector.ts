import { Injectable } from '@nestjs/common';
import {
  OHLCV,
  DetectionResult,
  PatternType,
  PatternCategory,
  PatternDirection,
  PatternTimeframe,
  PatternGeometry,
} from '../interfaces/pattern.interface';
import { CandlestickConfig } from '../interfaces/detection-config.interface';
import { ImageProcessor } from '../utils/image-processor';

/**
 * CandlestickPatternDetector recognises 1-3 candle Japanese candlestick patterns
 * using body/wick ratio analysis on raw OHLCV data.
 *
 * Patterns detected:
 *   1-bar:  Doji, Hammer, Inverted Hammer, Shooting Star, Hanging Man
 *   2-bar:  Bullish Engulfing, Bearish Engulfing, Harami (Bullish/Bearish)
 *   3-bar:  Morning Star, Evening Star, Three White Soldiers, Three Black Crows
 */
@Injectable()
export class CandlestickPatternDetector {

  /**
   * Scans the entire OHLCV series and returns all detected candlestick patterns.
   */
  detect(candles: OHLCV[], config: CandlestickConfig): DetectionResult[] {
    if (candles.length < 1) return [];

    const atr = ImageProcessor.atr(candles);
    const results: DetectionResult[] = [];

    for (let i = 0; i < candles.length; i++) {
      // Single-candle patterns
      if (i >= 0) {
        const single = this.detectSingleBar(candles, i, config, atr);
        results.push(...single);
      }
      // Two-candle patterns
      if (i >= 1) {
        const two = this.detectTwoBar(candles, i, config, atr);
        results.push(...two);
      }
      // Three-candle patterns
      if (i >= 2) {
        const three = this.detectThreeBar(candles, i, config, atr);
        results.push(...three);
      }
    }

    return results;
  }

  // ── Single-candle patterns ─────────────────────────────────────────────────

  private detectSingleBar(
    candles: OHLCV[],
    i: number,
    config: CandlestickConfig,
    atr: number,
  ): DetectionResult[] {
    const c = candles[i];
    const results: DetectionResult[] = [];

    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) return [];

    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    const bodyRatio = body / range;
    const isBullish = c.close >= c.open;

    // Minimum body filter to avoid noise
    if (atr > 0 && body < atr * config.minBodyAtrFraction && bodyRatio > 0.05) {
      // Allow doji through regardless
    }

    // ── Doji ────────────────────────────────────────────────────────────────
    if (bodyRatio <= config.dojiBodyThreshold && range > 0) {
      results.push(
        this.build(candles, i, i, PatternType.DOJI, PatternDirection.NEUTRAL, 0.70 + (0.1 - bodyRatio) * 2,
          'Doji: open ≈ close, indicating market indecision and potential reversal.'),
      );
    }

    // ── Hammer ──────────────────────────────────────────────────────────────
    // Long lower wick, small body at top, tiny upper wick — bullish reversal
    if (
      lowerWick >= body * config.hammerWickRatio &&
      upperWick <= body * 0.3 &&
      bodyRatio > config.dojiBodyThreshold
    ) {
      // Check prior trend: at least 3 declining closes for valid hammer
      const inDowntrend = i >= 3
        ? candles[i - 3].close > candles[i - 2].close && candles[i - 2].close > candles[i - 1].close
        : true;

      const confidence = Math.min(0.90, 0.60 + (lowerWick / body - 2) * 0.05 + (inDowntrend ? 0.1 : 0));
      results.push(
        this.build(candles, i, i, PatternType.HAMMER, PatternDirection.BULLISH, confidence,
          'Hammer: long lower wick signals rejection of lower prices; potential bullish reversal.'),
      );
    }

    // ── Shooting Star ────────────────────────────────────────────────────────
    // Long upper wick, small body at bottom, tiny lower wick — bearish reversal
    if (
      upperWick >= body * config.shootingStarWickRatio &&
      lowerWick <= body * 0.3 &&
      bodyRatio > config.dojiBodyThreshold
    ) {
      const inUptrend = i >= 3
        ? candles[i - 3].close < candles[i - 2].close && candles[i - 2].close < candles[i - 1].close
        : true;

      const confidence = Math.min(0.90, 0.60 + (upperWick / body - 2) * 0.05 + (inUptrend ? 0.1 : 0));
      results.push(
        this.build(candles, i, i, PatternType.SHOOTING_STAR, PatternDirection.BEARISH, confidence,
          'Shooting Star: long upper wick signals rejection of higher prices; potential bearish reversal.'),
      );
    }

    // ── Inverted Hammer ──────────────────────────────────────────────────────
    // After a downtrend: long upper wick, small body — bullish
    if (
      upperWick >= body * config.shootingStarWickRatio &&
      lowerWick <= body * 0.3 &&
      bodyRatio > config.dojiBodyThreshold
    ) {
      const inDowntrend = i >= 2 && candles[i - 1].close < candles[i - 2].close;
      if (inDowntrend) {
        results.push(
          this.build(candles, i, i, PatternType.INVERTED_HAMMER, PatternDirection.BULLISH, 0.62,
            'Inverted Hammer: potential bullish reversal; buyers attempted to push price up.'),
        );
      }
    }

    // ── Hanging Man ──────────────────────────────────────────────────────────
    // After an uptrend: long lower wick, small body — bearish
    if (
      lowerWick >= body * config.hammerWickRatio &&
      upperWick <= body * 0.3 &&
      bodyRatio > config.dojiBodyThreshold
    ) {
      const inUptrend = i >= 2 && candles[i - 1].close > candles[i - 2].close;
      if (inUptrend) {
        results.push(
          this.build(candles, i, i, PatternType.HANGING_MAN, PatternDirection.BEARISH, 0.62,
            'Hanging Man: after an uptrend, signals potential bearish reversal.'),
        );
      }
    }

    return results;
  }

  // ── Two-candle patterns ───────────────────────────────────────────────────

  private detectTwoBar(
    candles: OHLCV[],
    i: number,
    config: CandlestickConfig,
    atr: number,
  ): DetectionResult[] {
    const prev = candles[i - 1];
    const curr = candles[i];
    const results: DetectionResult[] = [];

    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);
    const prevBull = prev.close > prev.open;
    const currBull = curr.close > curr.open;

    // ── Bullish Engulfing ────────────────────────────────────────────────────
    if (
      !prevBull && currBull &&
      curr.open < prev.close &&
      curr.close > prev.open &&
      currBody >= prevBody * config.engulfingMultiple
    ) {
      const overlapRatio = currBody / Math.max(prevBody, 1);
      const confidence = Math.min(0.92, 0.68 + Math.min(overlapRatio - 1, 1) * 0.12);
      results.push(
        this.build(candles, i - 1, i, PatternType.BULLISH_ENGULFING, PatternDirection.BULLISH, confidence,
          'Bullish Engulfing: current bullish candle completely engulfs prior bearish candle.'),
      );
    }

    // ── Bearish Engulfing ────────────────────────────────────────────────────
    if (
      prevBull && !currBull &&
      curr.open > prev.close &&
      curr.close < prev.open &&
      currBody >= prevBody * config.engulfingMultiple
    ) {
      const overlapRatio = currBody / Math.max(prevBody, 1);
      const confidence = Math.min(0.92, 0.68 + Math.min(overlapRatio - 1, 1) * 0.12);
      results.push(
        this.build(candles, i - 1, i, PatternType.BEARISH_ENGULFING, PatternDirection.BEARISH, confidence,
          'Bearish Engulfing: current bearish candle completely engulfs prior bullish candle.'),
      );
    }

    // ── Bullish Harami ───────────────────────────────────────────────────────
    // Small bullish body inside large bearish body
    if (
      !prevBull && currBull &&
      curr.open > prev.close &&
      curr.close < prev.open &&
      currBody < prevBody * 0.6
    ) {
      results.push(
        this.build(candles, i - 1, i, PatternType.HARAMI_BULLISH, PatternDirection.BULLISH, 0.60,
          'Bullish Harami: small bullish candle inside prior bearish candle, potential reversal.'),
      );
    }

    // ── Bearish Harami ───────────────────────────────────────────────────────
    if (
      prevBull && !currBull &&
      curr.open < prev.close &&
      curr.close > prev.open &&
      currBody < prevBody * 0.6
    ) {
      results.push(
        this.build(candles, i - 1, i, PatternType.HARAMI_BEARISH, PatternDirection.BEARISH, 0.60,
          'Bearish Harami: small bearish candle inside prior bullish candle, potential reversal.'),
      );
    }

    return results;
  }

  // ── Three-candle patterns ─────────────────────────────────────────────────

  private detectThreeBar(
    candles: OHLCV[],
    i: number,
    config: CandlestickConfig,
    atr: number,
  ): DetectionResult[] {
    const a = candles[i - 2];
    const b = candles[i - 1];
    const c = candles[i];
    const results: DetectionResult[] = [];

    const aBody = Math.abs(a.close - a.open);
    const bBody = Math.abs(b.close - b.open);
    const cBody = Math.abs(c.close - c.open);

    const aBull = a.close > a.open;
    const bBull = b.close > b.open;
    const cBull = c.close > c.open;

    // ── Morning Star ──────────────────────────────────────────────────────────
    // Long bearish → small body gap down → long bullish closing above midpoint of first
    if (
      !aBull && bBody < aBody * 0.5 &&
      b.high < a.close &&        // gap down
      cBull && cBody > aBody * 0.5 &&
      c.close > (a.open + a.close) / 2
    ) {
      results.push(
        this.build(candles, i - 2, i, PatternType.MORNING_STAR, PatternDirection.BULLISH, 0.82,
          'Morning Star: three-candle bullish reversal after downtrend.'),
      );
    }

    // ── Evening Star ──────────────────────────────────────────────────────────
    if (
      aBull && bBody < aBody * 0.5 &&
      b.low > a.close &&          // gap up
      !cBull && cBody > aBody * 0.5 &&
      c.close < (a.open + a.close) / 2
    ) {
      results.push(
        this.build(candles, i - 2, i, PatternType.EVENING_STAR, PatternDirection.BEARISH, 0.82,
          'Evening Star: three-candle bearish reversal after uptrend.'),
      );
    }

    // ── Three White Soldiers ──────────────────────────────────────────────────
    if (
      aBull && bBull && cBull &&
      b.open > a.open && b.open < a.close &&
      c.open > b.open && c.open < b.close &&
      c.close > b.close && b.close > a.close &&
      cBody >= aBody * 0.7 && bBody >= aBody * 0.7
    ) {
      results.push(
        this.build(candles, i - 2, i, PatternType.THREE_WHITE_SOLDIERS, PatternDirection.BULLISH, 0.80,
          'Three White Soldiers: three consecutive bullish candles; strong upward momentum.'),
      );
    }

    // ── Three Black Crows ─────────────────────────────────────────────────────
    if (
      !aBull && !bBull && !cBull &&
      b.open < a.open && b.open > a.close &&
      c.open < b.open && c.open > b.close &&
      c.close < b.close && b.close < a.close &&
      cBody >= aBody * 0.7 && bBody >= aBody * 0.7
    ) {
      results.push(
        this.build(candles, i - 2, i, PatternType.THREE_BLACK_CROWS, PatternDirection.BEARISH, 0.80,
          'Three Black Crows: three consecutive bearish candles; strong downward momentum.'),
      );
    }

    return results;
  }

  // ── Builder ───────────────────────────────────────────────────────────────

  private build(
    candles: OHLCV[],
    start: number,
    end: number,
    type: PatternType,
    direction: PatternDirection,
    confidence: number,
    description: string,
  ): DetectionResult {
    const slice = candles.slice(start, end + 1);
    const { min, max } = ImageProcessor.priceRange(slice);
    const width = end - start + 1;

    const geometry: PatternGeometry = {
      pivots: [],
      keyLevels: [],
      patternHeight: max - min,
      patternWidth: width,
      symmetryScore: 1.0, // candlestick patterns are single- or few-candle
    };

    return {
      patternType: type,
      category: PatternCategory.CANDLESTICK,
      direction,
      timeframe: PatternTimeframe.MICRO,
      confidence: Math.max(0, Math.min(1, confidence)),
      startIndex: start,
      endIndex: end,
      startDate: candles[start].timestamp,
      endDate: candles[end].timestamp,
      geometry,
      description,
      metadata: {
        open: candles[end].open,
        high: candles[end].high,
        low: candles[end].low,
        close: candles[end].close,
        volume: candles[end].volume,
      },
    };
  }
}
