import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PriceHistory } from '../../prices/entities/price-history.entity';
import {
  OHLCV,
  DetectionResult,
  PatternType,
  PatternCategory,
  PatternDirection,
  PatternTimeframe,
} from './interfaces/pattern.interface';
import { DetectionConfig, DEFAULT_DETECTION_CONFIG } from './interfaces/detection-config.interface';
import { ImageProcessor } from './utils/image-processor';
import { ShapeMatcher } from './utils/shape-matcher';
import { ConfidenceScorer } from './utils/confidence-scorer';
import { CandlestickPatternDetector } from './detectors/candlestick-pattern.detector';
import { TrendPatternDetector } from './detectors/trend-pattern.detector';
import { ReversalPatternDetector } from './detectors/reversal-pattern.detector';
import { ConsolidationPatternDetector } from './detectors/consolidation-pattern.detector';
import { PatternHistory } from './entities/pattern-history.entity';

/**
 * ChartAnalyzerService is the orchestration layer.
 *
 * Responsibilities:
 *  1. Load price history from the DB and construct OHLCV candles.
 *  2. Run all four detector families in sequence.
 *  3. Re-score each result using ConfidenceScorer (volume, momentum, history).
 *  4. Deduplicate overlapping patterns of the same type.
 *  5. Annotate results with support/resistance key levels.
 *  6. Return sorted, filtered DetectionResults.
 */
@Injectable()
export class ChartAnalyzerService {
  private readonly logger = new Logger(ChartAnalyzerService.name);

  constructor(
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepo: Repository<PriceHistory>,
    @InjectRepository(PatternHistory)
    private readonly patternHistoryRepo: Repository<PatternHistory>,
    private readonly candlestickDetector: CandlestickPatternDetector,
    private readonly trendDetector: TrendPatternDetector,
    private readonly reversalDetector: ReversalPatternDetector,
    private readonly consolidationDetector: ConsolidationPatternDetector,
  ) {}

  /**
   * Runs all detectors on price data for the given asset pair.
   *
   * @param assetPair    e.g. 'XLM/USDC'
   * @param lookback     Number of hourly price points to load (default 100)
   * @param config       Optional detection configuration override
   * @param category     If provided, restrict to a single pattern category
   */
  async analyze(
    assetPair: string,
    lookback = 100,
    config: DetectionConfig = DEFAULT_DETECTION_CONFIG,
    category?: PatternCategory,
  ): Promise<DetectionResult[]> {
    const candles = await this.loadCandles(assetPair, lookback);

    if (candles.length < 10) {
      this.logger.warn(`Insufficient price history for ${assetPair}: ${candles.length} points`);
      return [];
    }

    return this.runDetectors(candles, config, category);
  }

  /**
   * Runs all detectors on an externally supplied OHLCV array (for testing
   * or for providers that push candles directly).
   */
  async analyzeCandles(
    candles: OHLCV[],
    config: DetectionConfig = DEFAULT_DETECTION_CONFIG,
    category?: PatternCategory,
  ): Promise<DetectionResult[]> {
    return this.runDetectors(candles, config, category);
  }

  /**
   * Returns the historical success rate for a given asset pair and pattern type.
   * Used by ConfidenceScorer to adjust the historicalAccuracy factor.
   */
  async getHistoricalAccuracy(assetPair: string, patternType: string): Promise<number> {
    const history = await this.patternHistoryRepo.findOne({
      where: { assetPair, patternType: patternType as any },
    });
    return history?.successRate ?? 0.5;
  }

  // ── Core pipeline ─────────────────────────────────────────────────────────

  private async runDetectors(
    candles: OHLCV[],
    config: DetectionConfig,
    category?: PatternCategory,
  ): Promise<DetectionResult[]> {
    const pivots = ImageProcessor.detectPivots(candles, config.pivotStrength);
    const srLevels = ShapeMatcher.findSupportResistanceLevels(
      pivots,
      config.supportResistance.touchTolerance,
      config.supportResistance.minTouches,
      config.supportResistance.maxLevels,
    );

    const allResults: DetectionResult[] = [];

    // Inject support/resistance key levels into all results' geometry
    const injectSR = (results: DetectionResult[]): DetectionResult[] =>
      results.map((r) => ({ ...r, geometry: { ...r.geometry, keyLevels: srLevels } }));

    if (!category || category === PatternCategory.CANDLESTICK) {
      const cs = this.candlestickDetector.detect(candles, config.candlestick);
      allResults.push(...injectSR(cs));
    }

    if (!category || category === PatternCategory.TREND) {
      const tr = this.trendDetector.detect(candles, pivots, config.trend);
      allResults.push(...injectSR(tr));
    }

    if (!category || category === PatternCategory.REVERSAL) {
      const rv = this.reversalDetector.detect(candles, pivots, config.reversal);
      allResults.push(...injectSR(rv));
    }

    if (!category || category === PatternCategory.CONSOLIDATION) {
      const co = this.consolidationDetector.detect(candles, pivots, config.consolidation);
      allResults.push(...injectSR(co));
    }

    if (!category || category === PatternCategory.SUPPORT_RESISTANCE) {
      const srResults = this.buildSRResults(candles, srLevels);
      allResults.push(...srResults);
    }

    // Re-score, deduplicate, filter
    const rescored = await this.rescoreResults(allResults, candles);
    const deduped = this.deduplicate(rescored);
    const filtered = deduped.filter((r) => r.confidence >= config.minConfidence);

    return filtered.sort((a, b) => b.confidence - a.confidence);
  }

  // ── Support/Resistance result builder ─────────────────────────────────────

  private buildSRResults(candles: OHLCV[], levels: ReturnType<typeof ShapeMatcher.findSupportResistanceLevels>): DetectionResult[] {
    const endIdx = candles.length - 1;

    return levels.map((level) => {
      const patternType = level.type === 'RESISTANCE' ? PatternType.RESISTANCE_LEVEL : PatternType.SUPPORT_LEVEL;
      const direction = level.type === 'RESISTANCE' ? PatternDirection.BEARISH : PatternDirection.BULLISH;
      const confidence = Math.min(0.90, 0.40 + level.strength * 0.5);

      return {
        patternType,
        category: PatternCategory.SUPPORT_RESISTANCE,
        direction,
        timeframe: PatternTimeframe.MEDIUM,
        confidence,
        startIndex: 0,
        endIndex: endIdx,
        startDate: level.firstSeen,
        endDate: level.lastSeen,
        geometry: {
          pivots: [],
          keyLevels: [level],
          patternHeight: 0,
          patternWidth: candles.length,
          symmetryScore: 1,
        },
        breakoutLevel: level.price,
        description: `${level.type} at ${level.price.toFixed(4)} (${level.touches} touches, strength ${(level.strength * 100).toFixed(0)}%).`,
        metadata: {
          priceLevel: level.price,
          touches: level.touches,
          strength: level.strength,
          type: level.type,
        },
      } as DetectionResult;
    });
  }

  // ── Re-scoring ────────────────────────────────────────────────────────────

  private async rescoreResults(
    results: DetectionResult[],
    candles: OHLCV[],
  ): Promise<DetectionResult[]> {
    return Promise.all(
      results.map(async (result) => {
        const historicalAccuracy = 0.5; // Default; PatternDetectorService injects real value
        const newConfidence = ConfidenceScorer.scoreResult(result, candles, historicalAccuracy);
        return { ...result, confidence: newConfidence };
      }),
    );
  }

  // ── Deduplication ─────────────────────────────────────────────────────────

  /**
   * Removes duplicate detections of the same pattern type within overlapping
   * index windows. Keeps the highest-confidence result in each group.
   */
  private deduplicate(results: DetectionResult[]): DetectionResult[] {
    const kept: DetectionResult[] = [];

    for (const candidate of results) {
      const overlapping = kept.findIndex(
        (existing) =>
          existing.patternType === candidate.patternType &&
          existing.startIndex <= candidate.endIndex &&
          candidate.startIndex <= existing.endIndex,
      );

      if (overlapping === -1) {
        kept.push(candidate);
      } else if (candidate.confidence > kept[overlapping].confidence) {
        kept[overlapping] = candidate;
      }
    }

    return kept;
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  /**
   * Loads PriceHistory rows and converts them to synthetic OHLCV candles.
   *
   * Since PriceHistory only stores a single close price per hour, we synthesise
   * OHLC using adjacent price differences (a common practice for single-source
   * data that lacks separate bid/ask spread information).
   */
  async loadCandles(assetPair: string, lookback: number): Promise<OHLCV[]> {
    const rows = await this.priceHistoryRepo.find({
      where: { assetPair },
      order: { timestamp: 'DESC' },
      take: lookback,
    });

    if (rows.length === 0) return [];

    // Reverse to chronological order
    rows.reverse();

    return rows.map((row, i) => {
      const close = Number(row.price);
      const prev = i > 0 ? Number(rows[i - 1].price) : close;
      const delta = Math.abs(close - prev);
      // Simulate OHLC from adjacent close prices
      const open = prev;
      const high = Math.max(open, close) + delta * 0.1;
      const low = Math.min(open, close) - delta * 0.1;

      return {
        timestamp: row.timestamp,
        open,
        high,
        low,
        close,
        volume: (row.metadata as any)?.volume ?? 1_000_000,
      };
    });
  }
}
