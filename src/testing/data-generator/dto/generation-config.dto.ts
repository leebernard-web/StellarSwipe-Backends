export class GenerationConfigDto {
  userCount: number = 10;
  signalsPerUser: number = 5;
  tradesPerSignal: number = 3;
  positionsPerUser: number = 4;
  seed?: number;
  locale?: string = 'en';
}
