import { faker } from '@faker-js/faker';
import { Signal, SignalType, SignalStatus, SignalOutcome } from '../../../signals/entities/signal.entity';
import { DataTemplate } from '../interfaces/data-template.interface';
import { randomAssetPair, decimalPrice, pastDate, futureDate } from '../utils/realistic-data';
import { weightedPick } from '../utils/faker-extensions';

export class SignalGenerator implements DataTemplate<Partial<Signal>> {
  generate(overrides: Partial<Signal> = {}): Partial<Signal> {
    const pair = randomAssetPair();
    const type = faker.helpers.enumValue(SignalType);
    const entryPrice = parseFloat(decimalPrice(0.05, 500));
    const targetPrice = type === SignalType.BUY
      ? (entryPrice * faker.number.float({ min: 1.02, max: 1.30, fractionDigits: 4 })).toFixed(8)
      : (entryPrice * faker.number.float({ min: 0.70, max: 0.98, fractionDigits: 4 })).toFixed(8);
    const stopLoss = type === SignalType.BUY
      ? (entryPrice * faker.number.float({ min: 0.85, max: 0.97, fractionDigits: 4 })).toFixed(8)
      : (entryPrice * faker.number.float({ min: 1.03, max: 1.15, fractionDigits: 4 })).toFixed(8);

    const status = weightedPick(
      [SignalStatus.ACTIVE, SignalStatus.CLOSED, SignalStatus.EXPIRED, SignalStatus.CANCELLED],
      [50, 30, 15, 5],
    );
    const outcome = status === SignalStatus.ACTIVE
      ? SignalOutcome.PENDING
      : faker.helpers.enumValue(SignalOutcome);

    return {
      id: faker.string.uuid(),
      providerId: faker.string.uuid(),
      baseAsset: pair.base,
      counterAsset: pair.counter,
      type,
      status,
      outcome,
      entryPrice: entryPrice.toFixed(8),
      targetPrice,
      stopLossPrice: stopLoss,
      currentPrice: decimalPrice(entryPrice * 0.8, entryPrice * 1.2),
      closePrice: status !== SignalStatus.ACTIVE ? decimalPrice(entryPrice * 0.85, entryPrice * 1.25) : null,
      copiersCount: faker.number.int({ min: 0, max: 500 }),
      totalCopiedVolume: decimalPrice(0, 100000),
      confidenceScore: faker.number.int({ min: 30, max: 95 }),
      executedCount: faker.number.int({ min: 0, max: 200 }),
      successRate: faker.number.float({ min: 30, max: 90, fractionDigits: 2 }),
      totalProfitLoss: (faker.number.float({ min: -5000, max: 15000, fractionDigits: 8 })).toFixed(8),
      rationale: faker.helpers.arrayElement([
        'Strong support level with bullish divergence on RSI.',
        'Breaking out of consolidation with high volume.',
        'Bearish engulfing pattern at resistance zone.',
        'Moving average crossover confirmed on 4H chart.',
        null,
      ]),
      expiresAt: futureDate(7),
      closedAt: status !== SignalStatus.ACTIVE ? pastDate(30) : null,
      gracePeriodEndsAt: null,
      metadata: { source: 'test-generator', version: '1.0' },
      createdAt: pastDate(60),
      updatedAt: pastDate(5),
      deletedAt: null,
      ...overrides,
    };
  }

  generateMany(count: number, overrides: Partial<Signal> = {}): Partial<Signal>[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }
}
