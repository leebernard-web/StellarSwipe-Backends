import { Signal, SignalStatus, SignalOutcome, SignalType } from '../../../signals/entities/signal.entity';
import { SignalGenerator } from '../generators/signal-generator';

const generator = new SignalGenerator();

export const SignalFactory = {
  build: (overrides: Partial<Signal> = {}): Partial<Signal> => generator.generate(overrides),
  buildMany: (count: number, overrides: Partial<Signal> = {}): Partial<Signal>[] => generator.generateMany(count, overrides),
  buildActive: (overrides: Partial<Signal> = {}): Partial<Signal> =>
    generator.generate({ status: SignalStatus.ACTIVE, outcome: SignalOutcome.PENDING, ...overrides }),
  buildClosed: (overrides: Partial<Signal> = {}): Partial<Signal> =>
    generator.generate({ status: SignalStatus.CLOSED, outcome: SignalOutcome.TARGET_HIT, ...overrides }),
  buildBuy: (overrides: Partial<Signal> = {}): Partial<Signal> =>
    generator.generate({ type: SignalType.BUY, ...overrides }),
  buildSell: (overrides: Partial<Signal> = {}): Partial<Signal> =>
    generator.generate({ type: SignalType.SELL, ...overrides }),
};
