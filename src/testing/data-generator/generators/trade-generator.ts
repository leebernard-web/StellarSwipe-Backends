import { faker } from '@faker-js/faker';
import { Trade, TradeStatus, TradeSide } from '../../../trades/entities/trade.entity';
import { DataTemplate } from '../interfaces/data-template.interface';
import { randomAssetPair, decimalPrice, txHash, pastDate } from '../utils/realistic-data';
import { weightedPick } from '../utils/faker-extensions';

export class TradeGenerator implements DataTemplate<Partial<Trade>> {
  generate(overrides: Partial<Trade> = {}): Partial<Trade> {
    const pair = randomAssetPair();
    const side = faker.helpers.enumValue(TradeSide);
    const entryPrice = parseFloat(decimalPrice(0.05, 500));
    const amount = parseFloat(decimalPrice(10, 10000));
    const totalValue = (entryPrice * amount).toFixed(8);
    const feeAmount = (parseFloat(totalValue) * 0.003).toFixed(8);

    const status = weightedPick(
      [TradeStatus.COMPLETED, TradeStatus.SETTLED, TradeStatus.PENDING, TradeStatus.FAILED, TradeStatus.CANCELLED],
      [40, 30, 15, 10, 5],
    );

    const isSettled = [TradeStatus.COMPLETED, TradeStatus.SETTLED].includes(status);
    const exitPrice = isSettled ? decimalPrice(entryPrice * 0.85, entryPrice * 1.25) : undefined;
    const profitLoss = isSettled && exitPrice
      ? ((parseFloat(exitPrice) - entryPrice) * amount * (side === TradeSide.BUY ? 1 : -1)).toFixed(8)
      : undefined;
    const profitLossPercentage = isSettled && exitPrice
      ? (((parseFloat(exitPrice) - entryPrice) / entryPrice) * 100).toFixed(4)
      : undefined;

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      signalId: faker.string.uuid(),
      status,
      side,
      baseAsset: pair.base,
      counterAsset: pair.counter,
      entryPrice: entryPrice.toFixed(8),
      amount: amount.toFixed(8),
      totalValue,
      feeAmount,
      transactionHash: isSettled ? txHash() : undefined,
      ledger: isSettled ? faker.number.int({ min: 40000000, max: 50000000 }) : undefined,
      exitPrice,
      profitLoss,
      profitLossPercentage,
      stopLossPrice: decimalPrice(entryPrice * 0.85, entryPrice * 0.97),
      takeProfitPrice: decimalPrice(entryPrice * 1.05, entryPrice * 1.30),
      executedAt: isSettled ? pastDate(30) : undefined,
      closedAt: isSettled ? pastDate(20) : undefined,
      metadata: { source: 'test-generator' },
      createdAt: pastDate(60),
      updatedAt: pastDate(5),
      ...overrides,
    };
  }

  generateMany(count: number, overrides: Partial<Trade> = {}): Partial<Trade>[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }
}
