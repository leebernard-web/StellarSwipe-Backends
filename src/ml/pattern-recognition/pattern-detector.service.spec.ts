import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PatternDetectorService } from './pattern-detector.service';
import { ChartAnalyzerService } from './chart-analyzer.service';
import { DetectedPattern, PatternOutcome } from './entities/detected-pattern.entity';
import { PatternHistory } from './entities/pattern-history.entity';
import { PriceHistory } from '../../prices/entities/price-history.entity';
import {
  PatternType,
  PatternCategory,
  PatternDirection,
  PatternTimeframe,
} from './interfaces/pattern.interface';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ avg: '0.65' }),
  })),
});

const mockCache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

const mockChartAnalyzer = {
  analyze: jest.fn(),
  loadCandles: jest.fn(),
  getHistoricalAccuracy: jest.fn().mockResolvedValue(0.5),
};

const mockEvents = { emit: jest.fn() };

const sampleResult = {
  patternType: PatternType.HEAD_AND_SHOULDERS,
  category: PatternCategory.REVERSAL,
  direction: PatternDirection.BEARISH,
  timeframe: PatternTimeframe.MEDIUM,
  confidence: 0.82,
  startIndex: 5,
  endIndex: 45,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-10'),
  geometry: { pivots: [], keyLevels: [], patternHeight: 0.05, patternWidth: 40, symmetryScore: 0.88 },
  priceTarget: 0.10,
  stopLoss: 0.13,
  breakoutLevel: 0.115,
  description: 'Head & Shoulders: bearish reversal.',
  metadata: {},
};

describe('PatternDetectorService', () => {
  let service: PatternDetectorService;
  let patternRepo: ReturnType<typeof mockRepo>;
  let historyRepo: ReturnType<typeof mockRepo>;
  let priceHistoryRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatternDetectorService,
        { provide: getRepositoryToken(DetectedPattern), useFactory: mockRepo },
        { provide: getRepositoryToken(PatternHistory), useFactory: mockRepo },
        { provide: getRepositoryToken(PriceHistory), useFactory: mockRepo },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: ChartAnalyzerService, useValue: mockChartAnalyzer },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();

    service = module.get(PatternDetectorService);
    patternRepo = module.get(getRepositoryToken(DetectedPattern));
    historyRepo = module.get(getRepositoryToken(PatternHistory));
    priceHistoryRepo = module.get(getRepositoryToken(PriceHistory));

    jest.clearAllMocks();
  });

  describe('detect', () => {
    it('returns cached result when available', async () => {
      const cached = { assetPair: 'XLM/USDC', patterns: [], count: 0, fromCache: false, topConfidence: 0, analysedAt: new Date() };
      mockCache.get.mockResolvedValue(cached);

      const result = await service.detect({ assetPair: 'XLM/USDC' });

      expect(result.fromCache).toBe(true);
      expect(mockChartAnalyzer.analyze).not.toHaveBeenCalled();
    });

    it('runs analysis and caches result on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockChartAnalyzer.analyze.mockResolvedValue([sampleResult]);
      mockChartAnalyzer.loadCandles.mockResolvedValue([
        { timestamp: new Date(), open: 0.12, high: 0.13, low: 0.11, close: 0.12, volume: 1000000 },
      ]);

      const savedPattern = {
        ...sampleResult,
        id: 'pat-1',
        assetPair: 'XLM/USDC',
        confidence: 0.82,
        patternStart: sampleResult.startDate,
        patternEnd: sampleResult.endDate,
        patternWidth: 40,
        startPrice: 0.12,
        endPrice: 0.12,
        patternHeight: 0.05,
        priceTarget: 0.10,
        stopLoss: 0.13,
        breakoutLevel: 0.115,
        outcome: PatternOutcome.PENDING,
        outcomePrice: null,
        outcomeAt: null,
        actualMovePct: null,
        detectedAt: new Date(),
        createdAt: new Date(),
        candleData: [],
        geometry: { pivots: [], keyLevels: [], patternHeight: 0.05, patternWidth: 40, symmetryScore: 0.88 },
      };

      patternRepo.create.mockReturnValue(savedPattern);
      patternRepo.save.mockResolvedValue(savedPattern);

      const result = await service.detect({ assetPair: 'XLM/USDC' });

      expect(mockChartAnalyzer.analyze).toHaveBeenCalledWith(
        'XLM/USDC', 100, expect.any(Object), undefined,
      );
      expect(patternRepo.save).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
      expect(result.fromCache).toBe(false);
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const cached = { assetPair: 'XLM/USDC', patterns: [], count: 0, fromCache: false, topConfidence: 0, analysedAt: new Date() };
      mockCache.get.mockResolvedValue(cached);
      mockChartAnalyzer.analyze.mockResolvedValue([]);
      mockChartAnalyzer.loadCandles.mockResolvedValue([]);

      await service.detect({ assetPair: 'XLM/USDC', forceRefresh: true });

      expect(mockChartAnalyzer.analyze).toHaveBeenCalled();
    });

    it('emits pattern.detected event for high-confidence patterns', async () => {
      mockCache.get.mockResolvedValue(null);
      mockChartAnalyzer.analyze.mockResolvedValue([sampleResult]); // confidence 0.82 >= 0.70

      const savedPattern = {
        id: 'pat-2',
        assetPair: 'XLM/USDC',
        confidence: 0.82,
        patternType: PatternType.HEAD_AND_SHOULDERS,
        category: PatternCategory.REVERSAL,
        direction: PatternDirection.BEARISH,
        priceTarget: 0.10,
        stopLoss: 0.13,
        breakoutLevel: 0.115,
        description: 'H&S',
        detectedAt: new Date(),
        patternStart: new Date(),
        patternEnd: new Date(),
        endPrice: 0.12,
        outcome: PatternOutcome.PENDING,
        outcomePrice: null,
        outcomeAt: null,
        actualMovePct: null,
      } as any;

      mockChartAnalyzer.loadCandles.mockResolvedValue([
        { timestamp: new Date(), open: 0.12, high: 0.125, low: 0.115, close: 0.12, volume: 500000 },
      ]);
      patternRepo.create.mockReturnValue(savedPattern);
      patternRepo.save.mockResolvedValue(savedPattern);

      await service.detect({ assetPair: 'XLM/USDC' });

      expect(mockEvents.emit).toHaveBeenCalledWith('pattern.detected', expect.objectContaining({
        patternId: 'pat-2',
        patternType: PatternType.HEAD_AND_SHOULDERS,
      }));
    });

    it('applies category filter to analysis', async () => {
      mockCache.get.mockResolvedValue(null);
      mockChartAnalyzer.analyze.mockResolvedValue([]);
      mockChartAnalyzer.loadCandles.mockResolvedValue([]);

      await service.detect({ assetPair: 'XLM/USDC', category: PatternCategory.CANDLESTICK });

      expect(mockChartAnalyzer.analyze).toHaveBeenCalledWith(
        'XLM/USDC', 100, expect.any(Object), PatternCategory.CANDLESTICK,
      );
    });

    it('returns empty patterns array when price history is insufficient', async () => {
      mockCache.get.mockResolvedValue(null);
      mockChartAnalyzer.analyze.mockResolvedValue([]);
      mockChartAnalyzer.loadCandles.mockResolvedValue([]);

      const result = await service.detect({ assetPair: 'RARE/XLM' });

      expect(result.patterns).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('resolveOutcomes', () => {
    it('updates TARGET_HIT when price reaches target', async () => {
      const pendingPattern = {
        id: 'pat-3',
        assetPair: 'XLM/USDC',
        outcome: PatternOutcome.PENDING,
        direction: PatternDirection.BULLISH,
        priceTarget: 0.15,
        stopLoss: 0.10,
        endPrice: 0.12,
        detectedAt: new Date(Date.now() - 2 * 3600 * 1000),
      };

      patternRepo.find.mockResolvedValue([pendingPattern]);
      priceHistoryRepo.findOne.mockResolvedValue({ price: '0.16', assetPair: 'XLM/USDC' });
      historyRepo.findOne.mockResolvedValue(null);
      historyRepo.create.mockReturnValue({ targetHits: 0, totalResolved: 0, stopHits: 0, invalidated: 0, rollingHistory: [] });
      historyRepo.save.mockResolvedValue({});
      patternRepo.update.mockResolvedValue({});

      await service.resolveOutcomes();

      expect(patternRepo.update).toHaveBeenCalledWith(
        'pat-3',
        expect.objectContaining({ outcome: PatternOutcome.TARGET_HIT }),
      );
    });

    it('expires patterns past the OUTCOME_CHECK_HOURS window', async () => {
      const oldPattern = {
        id: 'pat-4',
        assetPair: 'XLM/USDC',
        outcome: PatternOutcome.PENDING,
        direction: PatternDirection.BULLISH,
        priceTarget: 0.20,  // Never reached
        stopLoss: null,
        endPrice: 0.12,
        detectedAt: new Date(Date.now() - 80 * 3600 * 1000), // 80h old, beyond 72h limit
      };

      patternRepo.find.mockResolvedValue([oldPattern]);
      priceHistoryRepo.findOne.mockResolvedValue({ price: '0.13', assetPair: 'XLM/USDC' });
      historyRepo.findOne.mockResolvedValue(null);
      historyRepo.create.mockReturnValue({ targetHits: 0, totalResolved: 0, stopHits: 0, invalidated: 0, rollingHistory: [] });
      historyRepo.save.mockResolvedValue({});
      patternRepo.update.mockResolvedValue({});

      await service.resolveOutcomes();

      expect(patternRepo.update).toHaveBeenCalledWith(
        'pat-4',
        expect.objectContaining({ outcome: PatternOutcome.EXPIRED }),
      );
    });
  });

  describe('getGlobalStats', () => {
    it('returns global statistics with null successRate when no detections', async () => {
      patternRepo.count.mockResolvedValue(0);
      historyRepo.find.mockResolvedValue([]);

      const stats = await service.getGlobalStats();

      expect(stats.totalDetections).toBe(0);
      expect(stats.globalSuccessRate).toBeNull();
    });

    it('computes correct success rate', async () => {
      patternRepo.count
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(62);  // TARGET_HIT
      historyRepo.find.mockResolvedValue([]);

      const stats = await service.getGlobalStats();

      expect(stats.globalSuccessRate).toBeCloseTo(0.62, 2);
    });
  });
});
