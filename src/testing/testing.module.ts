import { Module } from '@nestjs/common';
import { TestDataGeneratorService } from './data-generator/test-data-generator.service';
import { UserGenerator } from './data-generator/generators/user-generator';
import { SignalGenerator } from './data-generator/generators/signal-generator';
import { TradeGenerator } from './data-generator/generators/trade-generator';
import { PortfolioGenerator } from './data-generator/generators/portfolio-generator';

@Module({
  providers: [
    TestDataGeneratorService,
    UserGenerator,
    SignalGenerator,
    TradeGenerator,
    PortfolioGenerator,
  ],
  exports: [TestDataGeneratorService],
})
export class TestingModule {}
