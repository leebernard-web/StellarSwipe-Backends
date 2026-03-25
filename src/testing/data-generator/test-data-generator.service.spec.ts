import { TestDataGeneratorService } from './test-data-generator.service';
import { UserGenerator } from './generators/user-generator';
import { SignalGenerator } from './generators/signal-generator';
import { TradeGenerator } from './generators/trade-generator';
import { PortfolioGenerator } from './generators/portfolio-generator';
import { GenerationConfigDto } from './dto/generation-config.dto';
import { SignalStatus, SignalType } from '../../signals/entities/signal.entity';
import { TradeStatus } from '../../trades/entities/trade.entity';

describe('TestDataGeneratorService', () => {
  let service: TestDataGeneratorService;

  beforeEach(() => {
    service = new TestDataGeneratorService(
      new UserGenerator(),
      new SignalGenerator(),
      new TradeGenerator(),
      new PortfolioGenerator(),
    );
  });

  describe('generate()', () => {
    it('should generate correct counts with default config', () => {
      const config = new GenerationConfigDto();
      const result = service.generate(config);

      expect(result.users).toHaveLength(10);
      expect(result.signals).toHaveLength(50);   // 10 users × 5 signals
      expect(result.trades).toHaveLength(150);   // 50 signals × 3 trades
      expect(result.positions).toHaveLength(40); // 10 users × 4 positions
    });

    it('should generate correct counts with custom config', () => {
      const config: GenerationConfigDto = { userCount: 2, signalsPerUser: 3, tradesPerSignal: 2, positionsPerUser: 1 };
      const result = service.generate(config);

      expect(result.users).toHaveLength(2);
      expect(result.signals).toHaveLength(6);
      expect(result.trades).toHaveLength(12);
      expect(result.positions).toHaveLength(2);
    });

    it('should produce reproducible data with a seed', () => {
      const config: GenerationConfigDto = { userCount: 3, signalsPerUser: 2, tradesPerSignal: 1, positionsPerUser: 1, seed: 42 };
      const first = service.generate(config);
      const second = service.generate(config);

      expect(first.users[0].username).toBe(second.users[0].username);
      expect(first.signals[0].entryPrice).toBe(second.signals[0].entryPrice);
    });

    it('should link signals to their provider users', () => {
      const config: GenerationConfigDto = { userCount: 2, signalsPerUser: 2, tradesPerSignal: 1, positionsPerUser: 1, seed: 1 };
      const result = service.generate(config);
      const userIds = new Set(result.users.map(u => u.id));

      result.signals.forEach(signal => {
        expect(userIds.has(signal.providerId!)).toBe(true);
      });
    });

    it('should link trades to their signals', () => {
      const config: GenerationConfigDto = { userCount: 1, signalsPerUser: 2, tradesPerSignal: 2, positionsPerUser: 1, seed: 2 };
      const result = service.generate(config);
      const signalIds = new Set(result.signals.map(s => s.id));

      result.trades.forEach(trade => {
        expect(signalIds.has(trade.signalId!)).toBe(true);
      });
    });

    it('should populate meta with correct counts', () => {
      const result = service.generate(new GenerationConfigDto());
      expect(result.meta.counts.users).toBe(result.users.length);
      expect(result.meta.counts.signals).toBe(result.signals.length);
      expect(result.meta.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('UserGenerator', () => {
    it('should generate a valid user shape', () => {
      const user = new UserGenerator().generate();
      expect(user.id).toBeDefined();
      expect(user.username).toMatch(/^[a-z0-9_]+$/);
      expect(user.walletAddress).toMatch(/^G[A-Z2-7]{55}$/);
      expect(typeof user.reputationScore).toBe('number');
    });
  });

  describe('SignalGenerator', () => {
    it('should generate a valid signal shape', () => {
      const signal = new SignalGenerator().generate();
      expect(signal.id).toBeDefined();
      expect(Object.values(SignalType)).toContain(signal.type);
      expect(Object.values(SignalStatus)).toContain(signal.status);
      expect(parseFloat(signal.entryPrice!)).toBeGreaterThan(0);
    });

    it('should set BUY target price above entry price', () => {
      // Run multiple times to account for randomness
      for (let i = 0; i < 20; i++) {
        const signal = new SignalGenerator().generate({ type: SignalType.BUY });
        expect(parseFloat(signal.targetPrice!)).toBeGreaterThan(parseFloat(signal.entryPrice!));
      }
    });
  });

  describe('TradeGenerator', () => {
    it('should generate a valid trade shape', () => {
      const trade = new TradeGenerator().generate();
      expect(trade.id).toBeDefined();
      expect(Object.values(TradeStatus)).toContain(trade.status);
      expect(parseFloat(trade.amount!)).toBeGreaterThan(0);
      expect(parseFloat(trade.totalValue!)).toBeGreaterThan(0);
    });

    it('should set profitLoss for completed trades', () => {
      const trade = new TradeGenerator().generate({ status: TradeStatus.COMPLETED });
      expect(trade.exitPrice).toBeDefined();
      expect(trade.profitLoss).toBeDefined();
    });
  });
});
