import { faker } from '@faker-js/faker';
import { Position } from '../../../portfolio/entities/position.entity';
import { TradeSide } from '../../../trades/entities/trade.entity';
import { DataTemplate } from '../interfaces/data-template.interface';
import { randomAssetPair, decimalPrice, pastDate } from '../utils/realistic-data';

export class PortfolioGenerator implements DataTemplate<Partial<Position>> {
  generate(overrides: Partial<Position> = {}): Partial<Position> {
    const pair = randomAssetPair();
    const entryPrice = parseFloat(decimalPrice(0.05, 500));
    const currentPrice = parseFloat(decimalPrice(entryPrice * 0.7, entryPrice * 1.5));
    const amount = parseFloat(decimalPrice(10, 5000));
    const side = faker.helpers.enumValue(TradeSide);
    const priceDiff = side === TradeSide.BUY ? currentPrice - entryPrice : entryPrice - currentPrice;
    const unrealizedPnL = (priceDiff * amount).toFixed(8);

    return {
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      tradeId: faker.string.uuid(),
      baseAsset: pair.base,
      counterAsset: pair.counter,
      side,
      amount: amount.toFixed(8),
      entryPrice: entryPrice.toFixed(8),
      currentPrice: currentPrice.toFixed(8),
      unrealizedPnL,
      isActive: faker.datatype.boolean({ probability: 0.75 }),
      createdAt: pastDate(90),
      updatedAt: pastDate(1),
      ...overrides,
    };
  }

  generateMany(count: number, overrides: Partial<Position> = {}): Partial<Position>[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }
}
