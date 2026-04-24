import { Trade, TradeStatus, TradeSide } from '../../../trades/entities/trade.entity';
import { TradeGenerator } from '../generators/trade-generator';

const generator = new TradeGenerator();

export const TradeFactory = {
  build: (overrides: Partial<Trade> = {}): Partial<Trade> => generator.generate(overrides),
  buildMany: (count: number, overrides: Partial<Trade> = {}): Partial<Trade>[] => generator.generateMany(count, overrides),
  buildCompleted: (overrides: Partial<Trade> = {}): Partial<Trade> =>
    generator.generate({ status: TradeStatus.COMPLETED, ...overrides }),
  buildPending: (overrides: Partial<Trade> = {}): Partial<Trade> =>
    generator.generate({ status: TradeStatus.PENDING, ...overrides }),
  buildFailed: (overrides: Partial<Trade> = {}): Partial<Trade> =>
    generator.generate({ status: TradeStatus.FAILED, exitPrice: undefined, profitLoss: undefined, ...overrides }),
  buildForUser: (userId: string, overrides: Partial<Trade> = {}): Partial<Trade> =>
    generator.generate({ userId, ...overrides }),
  buildForSignal: (signalId: string, userId: string, overrides: Partial<Trade> = {}): Partial<Trade> =>
    generator.generate({ signalId, userId, ...overrides }),
};
