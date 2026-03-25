import { faker } from '@faker-js/faker';

/** Weighted random pick: pass items with relative weights */
export function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = faker.number.float({ min: 0, max: total });
  for (let i = 0; i < items.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Generate a realistic bio for a signal provider */
export function providerBio(): string {
  const styles = [
    `${faker.number.int({ min: 2, max: 15 })}+ years trading crypto on Stellar DEX. Specialising in ${faker.helpers.arrayElement(['momentum', 'mean-reversion', 'breakout', 'scalping'])} strategies.`,
    `Algorithmic trader focused on ${faker.helpers.arrayElement(['XLM', 'USDC', 'AQUA'])} pairs. Win rate above ${faker.number.int({ min: 55, max: 80 })}%.`,
    `Former ${faker.helpers.arrayElement(['quant analyst', 'forex trader', 'market maker'])} now trading Stellar assets full-time.`,
  ];
  return faker.helpers.arrayElement(styles);
}

/** Seed faker for reproducible data */
export function seedFaker(seed: number): void {
  faker.seed(seed);
}
