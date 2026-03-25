import { faker } from '@faker-js/faker';

// Stellar asset pairs traded on SDEX
export const ASSET_PAIRS = [
  { base: 'XLM', counter: 'USDC' },
  { base: 'XLM', counter: 'BTC' },
  { base: 'USDC', counter: 'ETH' },
  { base: 'XLM', counter: 'ETH' },
  { base: 'AQUA', counter: 'XLM' },
  { base: 'yXLM', counter: 'USDC' },
  { base: 'SHX', counter: 'XLM' },
  { base: 'VELO', counter: 'USDC' },
];

export function randomAssetPair() {
  return faker.helpers.arrayElement(ASSET_PAIRS);
}

/** Stellar-style wallet address (G + 55 alphanumeric chars) */
export function stellarAddress(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return 'G' + Array.from({ length: 55 }, () => faker.helpers.arrayElement(chars.split(''))).join('');
}

/** Realistic decimal price string with up to 8 decimal places */
export function decimalPrice(min: number, max: number): string {
  return faker.number.float({ min, max, fractionDigits: 8 }).toFixed(8);
}

/** Stellar transaction hash (64 hex chars) */
export function txHash(): string {
  return faker.string.hexadecimal({ length: 64, casing: 'upper', prefix: '' });
}

/** Past date within the last N days */
export function pastDate(days: number): Date {
  return faker.date.recent({ days });
}

/** Future date within the next N days */
export function futureDate(days: number): Date {
  return faker.date.soon({ days });
}
