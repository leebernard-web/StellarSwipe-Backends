import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';

import { ChartAnalyzerService } from './chart-analyzer.service';
import { DetectedPattern, PatternOutcome } from './entities/detected-pattern.entity';
import { PatternHistory } from './entities/pattern-history.entity';
import {
  DetectionResult,
  PatternCategory,
  PatternDirection,
} from './interfaces/pattern.interface';
import { DetectionConfig, DEFAULT_DETECTION_CONFIG } from './interfaces/detection-config.interface';
import {
  RequestPatternDetectionDto,
  PatternDetectionResponseDto,
  DetectedPatternDto,
} from './dto/pattern-detection.dto';
import { PatternAlertDto } from './dto/pattern-alert.dto';
import { GlobalPatternStatsDto, AssetPatternStatsDto } from './dto/pattern-stats.dto';
import { PriceHistory } from '../../prices/entities/price-history.entity';

const CACHE_TTL_DETECTION = 60 * 10;   // 10 minutes
const ALERT_CONFIDENCE_THRESHOLD = 0.70;
const OUTCOME_CHECK_HOURS = 72;          // Check outcomes up to 72 h after detection

@Injectable()
export class PatternDetectorService {
  private readonly logger = new Logger(PatternDetectorService.name);

  constructor(
    @InjectRepository(DetectedPattern)
    private readonly patternRepo: Repository<DetectedPattern>,
    @InjectRepository(PatternHistory)
    private readonly historyRepo: Repository<PatternHistory>,
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepo: Repository<PriceHistory>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
    private readonly chartAnalyzer: ChartAnalyzerService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Detect patterns for an asset pair and return the response DTO.
   * Results are cached for CACHE_TTL_DETECTION seconds.
   */
  async detect(dto: RequestPatternDetectionDto): Promise<PatternDetectionResponseDto> {
    const cacheKey = `patterns:${dto.assetPair}:${dto.lookback ?? 100}:${dto.category ?? 'all'}`;

    if (!dto.forceRefresh) {
      const cached = await this.cache.get<PatternDetectionResponseDto>(cacheKey);
      if (cached) return { ...cached, fromCache: true };
    }

    const config: DetectionConfig = {
      ...DEFAULT_DETECTION_CONFIG,
      minConfidence: (dto.minConfidence ?? 45) / 100,
    };

    const results = await this.chartAnalyzer.analyze(
      dto.assetPair,
      dto.lookback ?? 100,
      config,
      dto.category,
    );

    // Persist and emit alerts for new high-confidence patterns
    const persistedPatterns = await this.persistResults(dto.assetPair, results, config);

    const response: PatternDetectionResponseDto = {
      assetPair: dto.assetPair,
      patterns: persistedPatterns.map((p) => this.toDto(p, results)),
      count: persistedPatterns.length,
      topConfidence: persistedPatterns.length > 0
        ? Math.round(persistedPatterns[0].confidence * 100) / 100
        : 0,
      fromCache: false,
      analysedAt: new Date(),
    };

    await this.cache.set(cacheKey, response, CACHE_TTL_DETECTION);
    return response;
  }

  /**
   * Returns aggregated pattern statistics across all asset pairs.
   */
  async getGlobalStats(periodDays = 30): Promise<GlobalPatternStatsDto> {
    const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000);

    const [total, resolved, histories] = await Promise.all([
      this.patternRepo.count({ where: { detectedAt: MoreThan(since) } }),
      this.patternRepo.count({
        where: { detectedAt: MoreThan(since), outcome: PatternOutcome.TARGET_HIT },
      }),
      this.historyRepo.find({ order: { successRate: 'DESC' } }),
    ]);

    const globalSuccessRate = total > 0 ? resolved / total : null;

    // Compute average confidence
    const avgConfidenceResult = await this.patternRepo
      .createQueryBuilder('p')
      .select('AVG(p.confidence)', 'avg')
      .where('p.detected_at > :since', { since })
      .getRawOne<{ avg: string }>();

    const avgConfidence = parseFloat(avgConfidenceResult?.avg ?? '0');

    return {
      totalDetections: total,
      totalResolved: resolved,
      globalSuccessRate,
      topPerformingPatterns: histories.slice(0, 10).map((h) => ({
        patternType: h.patternType,
        direction: h.direction,
        totalDetected: h.totalDetected,
        totalResolved: h.totalResolved,
        successRate: h.successRate,
        avgMovePct: h.avgMovePct,
        avgConfidence: h.avgConfidence,
        avgBarsToResolution: h.avgBarsToResolution,
      })),
      topAssetPairs: [],  // Populated by getAssetStats
      avgConfidence,
      computedAt: new Date(),
    };
  }

  /**
   * Returns pattern statistics for a specific asset pair.
   */
  async getAssetStats(assetPair: string, periodDays = 30): Promise<AssetPatternStatsDto> {
    const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000);

    const [total, histories] = await Promise.all([
      this.patternRepo.count({
        where: { assetPair, detectedAt: MoreThan(since) },
      }),
      this.historyRepo.find({ where: { assetPair } }),
    ]);

    const avgConfidenceResult = await this.patternRepo
      .createQueryBuilder('p')
      .select('AVG(p.confidence)', 'avg')
      .where('p.asset_pair = :assetPair', { assetPair })
      .andWhere('p.detected_at > :since', { since })
      .getRawOne<{ avg: string }>();

    const avgConfidence = parseFloat(avgConfidenceResult?.avg ?? '0');

    const targetHits = await this.patternRepo.count({
      where: { assetPair, detectedAt: MoreThan(since), outcome: PatternOutcome.TARGET_HIT },
    });

    return {
      assetPair,
      totalDetections: total,
      overallSuccessRate: total > 0 ? targetHits / total : null,
      byPatternType: histories.map((h) => ({
        patternType: h.patternType,
        direction: h.direction,
        totalDetected: h.totalDetected,
        totalResolved: h.totalResolved,
        successRate: h.successRate,
        avgMovePct: h.avgMovePct,
        avgConfidence: h.avgConfidence,
        avgBarsToResolution: h.avgBarsToResolution,
      })),
      mostFrequent: [],
      avgConfidence,
      periodDays,
    };
  }

  // ── Scheduled jobs ─────────────────────────────────────────────────────────

  /**
   * Hourly scan of all recently active asset pairs.
   */
  @Cron('0 * * * *')
  async runHourlyScan(): Promise<void> {
    const assetPairs = await this.getActiveAssetPairs();
    this.logger.log(`Hourly pattern scan: ${assetPairs.length} asset pairs`);

    for (const pair of assetPairs) {
      try {
        await this.detect({ assetPair: pair, lookback: 100, forceRefresh: true });
      } catch (err) {
        this.logger.warn(`Pattern scan failed for ${pair}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Every 4 hours: check pending patterns and update outcomes.
   */
  @Cron('0 */4 * * *')
  async resolveOutcomes(): Promise<void> {
    const cutoff = new Date(Date.now() - OUTCOME_CHECK_HOURS * 3600 * 1000);

    const pending = await this.patternRepo.find({
      where: { outcome: PatternOutcome.PENDING, detectedAt: MoreThan(cutoff) },
    });

    if (pending.length === 0) return;

    this.logger.log(`Checking outcomes for ${pending.length} pending patterns`);

    for (const pattern of pending) {
      await this.checkPatternOutcome(pattern);
    }

    this.logger.log('Outcome resolution complete');
  }

  /**
   * Daily history stats update at 04:00 UTC.
   */
  @Cron('0 4 * * *')
  async updatePatternHistory(): Promise<void> {
    this.logger.log('Updating pattern history statistics…');
    try {
      await this.rebuildHistoryStats();
      this.logger.log('Pattern history updated');
    } catch (err) {
      this.logger.error('Pattern history update failed', (err as Error).stack);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async persistResults(
    assetPair: string,
    results: DetectionResult[],
    config: DetectionConfig,
  ): Promise<DetectedPattern[]> {
    const saved: DetectedPattern[] = [];

    for (const result of results) {
      const candles = await this.chartAnalyzer.loadCandles(assetPair, 100);
      const startPrice = candles[result.startIndex]?.close ?? 0;
      const endPrice = candles[result.endIndex]?.close ?? 0;

      const entity = this.patternRepo.create({
        assetPair,
        patternType: result.patternType,
        category: result.category,
        direction: result.direction,
        timeframe: result.timeframe,
        confidence: result.confidence,
        patternStart: result.startDate,
        patternEnd: result.endDate,
        patternWidth: result.geometry.patternWidth,
        startPrice,
        endPrice,
        patternHeight: result.geometry.patternHeight,
        priceTarget: result.priceTarget ?? null,
        stopLoss: result.stopLoss ?? null,
        breakoutLevel: result.breakoutLevel ?? null,
        description: result.description,
        geometry: result.geometry as any,
        candleData: candles.slice(result.startIndex, result.endIndex + 1),
        outcome: PatternOutcome.PENDING,
        outcomePrice: null,
        outcomeAt: null,
        actualMovePct: null,
        detectedAt: new Date(),
      });

      const persisted = await this.patternRepo.save(entity);
      saved.push(persisted);

      // Emit alert for high-confidence patterns
      if (result.confidence >= ALERT_CONFIDENCE_THRESHOLD) {
        await this.emitAlert(persisted, endPrice);
      }
    }

    return saved;
  }

  private async emitAlert(pattern: DetectedPattern, currentPrice: number): Promise<void> {
    const rr = pattern.priceTarget && pattern.stopLoss
      ? Math.abs(pattern.priceTarget - currentPrice) / Math.abs(currentPrice - pattern.stopLoss)
      : undefined;

    const alert: PatternAlertDto = {
      patternId: pattern.id,
      assetPair: pattern.assetPair,
      patternType: pattern.patternType,
      category: pattern.category,
      direction: pattern.direction,
      confidence: Math.round(pattern.confidence * 100),
      currentPrice,
      priceTarget: pattern.priceTarget ?? undefined,
      stopLoss: pattern.stopLoss ?? undefined,
      breakoutLevel: pattern.breakoutLevel ?? undefined,
      message: pattern.description,
      detectedAt: pattern.detectedAt,
      riskRewardRatio: rr,
    };

    this.events.emit('pattern.detected', alert);
  }

  private async checkPatternOutcome(pattern: DetectedPattern): Promise<void> {
    const latestPrice = await this.priceHistoryRepo.findOne({
      where: { assetPair: pattern.assetPair },
      order: { timestamp: 'DESC' },
    });

    if (!latestPrice) return;

    const currentPrice = Number(latestPrice.price);
    const now = new Date();
    const ageHours = (now.getTime() - pattern.detectedAt.getTime()) / 3600000;

    let outcome: PatternOutcome | null = null;

    if (pattern.priceTarget && pattern.direction === PatternDirection.BULLISH) {
      if (currentPrice >= pattern.priceTarget) outcome = PatternOutcome.TARGET_HIT;
      else if (pattern.stopLoss && currentPrice <= pattern.stopLoss) outcome = PatternOutcome.STOP_HIT;
    } else if (pattern.priceTarget && pattern.direction === PatternDirection.BEARISH) {
      if (currentPrice <= pattern.priceTarget) outcome = PatternOutcome.TARGET_HIT;
      else if (pattern.stopLoss && currentPrice >= pattern.stopLoss) outcome = PatternOutcome.STOP_HIT;
    }

    if (!outcome && ageHours >= OUTCOME_CHECK_HOURS) {
      outcome = PatternOutcome.EXPIRED;
    }

    if (outcome) {
      const movePct = ((currentPrice - pattern.endPrice) / pattern.endPrice) * 100;

      await this.patternRepo.update(pattern.id, {
        outcome,
        outcomePrice: currentPrice,
        outcomeAt: now,
        actualMovePct: movePct,
      });

      await this.updateHistoryStats(pattern, outcome, movePct);
    }
  }

  private async updateHistoryStats(
    pattern: DetectedPattern,
    outcome: PatternOutcome,
    movePct: number,
  ): Promise<void> {
    let history = await this.historyRepo.findOne({
      where: {
        assetPair: pattern.assetPair,
        patternType: pattern.patternType,
        direction: pattern.direction,
      },
    });

    if (!history) {
      history = this.historyRepo.create({
        assetPair: pattern.assetPair,
        patternType: pattern.patternType,
        direction: pattern.direction,
        totalDetected: 0,
        totalResolved: 0,
        targetHits: 0,
        stopHits: 0,
        invalidated: 0,
        rollingHistory: [],
      });
    }

    history.totalResolved++;
    if (outcome === PatternOutcome.TARGET_HIT) {
      history.targetHits++;
      history.avgMovePct = history.avgMovePct == null
        ? movePct
        : (history.avgMovePct * (history.targetHits - 1) + movePct) / history.targetHits;
    } else if (outcome === PatternOutcome.STOP_HIT) {
      history.stopHits++;
    } else {
      history.invalidated++;
    }

    history.successRate = history.totalResolved > 0
      ? history.targetHits / history.totalResolved
      : null;

    await this.historyRepo.save(history);
  }

  private async rebuildHistoryStats(): Promise<void> {
    const pairs = await this.getActiveAssetPairs();

    for (const pair of pairs) {
      const histories = await this.historyRepo.find({ where: { assetPair: pair } });

      for (const h of histories) {
        const total = await this.patternRepo.count({
          where: { assetPair: pair, patternType: h.patternType },
        });
        h.totalDetected = total;

        const avgConf = await this.patternRepo
          .createQueryBuilder('p')
          .select('AVG(p.confidence)', 'avg')
          .where('p.asset_pair = :pair AND p.pattern_type = :type', { pair, type: h.patternType })
          .getRawOne<{ avg: string }>();

        h.avgConfidence = parseFloat(avgConf?.avg ?? '0');
        await this.historyRepo.save(h);
      }
    }
  }

  private async getActiveAssetPairs(): Promise<string[]> {
    const rows = await this.priceHistoryRepo
      .createQueryBuilder('ph')
      .select('DISTINCT ph.asset_pair', 'assetPair')
      .where('ph.timestamp > :since', {
        since: new Date(Date.now() - 24 * 3600 * 1000),
      })
      .getRawMany<{ assetPair: string }>();

    return rows.map((r) => r.assetPair);
  }

  private toDto(pattern: DetectedPattern, results: DetectionResult[]): DetectedPatternDto {
    const result = results.find((r) => r.patternType === pattern.patternType);

    return {
      id: pattern.id,
      assetPair: pattern.assetPair,
      patternType: pattern.patternType,
      category: pattern.category,
      direction: pattern.direction,
      timeframe: pattern.timeframe,
      confidence: Math.round(pattern.confidence * 10000) / 100,
      patternStart: pattern.patternStart,
      patternEnd: pattern.patternEnd,
      startPrice: pattern.startPrice,
      endPrice: pattern.endPrice,
      priceTarget: pattern.priceTarget ?? undefined,
      stopLoss: pattern.stopLoss ?? undefined,
      breakoutLevel: pattern.breakoutLevel ?? undefined,
      description: pattern.description,
      geometry: result?.geometry as any ?? { pivots: [], keyLevels: [], patternHeight: 0, patternWidth: 0, symmetryScore: 0 },
      detectedAt: pattern.detectedAt,
    };
  }
}
