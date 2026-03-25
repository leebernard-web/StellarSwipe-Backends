import { Injectable, Logger } from '@nestjs/common';
import { UserGenerator } from './generators/user-generator';
import { SignalGenerator } from './generators/signal-generator';
import { TradeGenerator } from './generators/trade-generator';
import { PortfolioGenerator } from './generators/portfolio-generator';
import { GenerationConfigDto } from './dto/generation-config.dto';
import { GeneratedDataDto } from './dto/generated-data.dto';
import { seedFaker } from './utils/faker-extensions';

@Injectable()
export class TestDataGeneratorService {
  private readonly logger = new Logger(TestDataGeneratorService.name);

  constructor(
    private readonly userGenerator: UserGenerator,
    private readonly signalGenerator: SignalGenerator,
    private readonly tradeGenerator: TradeGenerator,
    private readonly portfolioGenerator: PortfolioGenerator,
  ) {}

  generate(config: GenerationConfigDto = new GenerationConfigDto()): GeneratedDataDto {
    if (config.seed !== undefined) seedFaker(config.seed);

    this.logger.log(`Generating test data: ${config.userCount} users`);

    const users = this.userGenerator.generateMany(config.userCount);

    const signals = users.flatMap(user =>
      this.signalGenerator.generateMany(config.signalsPerUser, { providerId: user.id }),
    );

    const trades = signals.flatMap(signal =>
      this.tradeGenerator.generateMany(config.tradesPerSignal, {
        signalId: signal.id,
        userId: signal.providerId,
        baseAsset: signal.baseAsset,
        counterAsset: signal.counterAsset,
      }),
    );

    const positions = users.flatMap(user =>
      this.portfolioGenerator.generateMany(config.positionsPerUser, { userId: user.id }),
    );

    return {
      users,
      signals,
      trades,
      positions,
      meta: {
        generatedAt: new Date(),
        counts: { users: users.length, signals: signals.length, trades: trades.length, positions: positions.length },
      },
    };
  }
}
