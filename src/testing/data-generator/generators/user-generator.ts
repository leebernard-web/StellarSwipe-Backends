import { faker } from '@faker-js/faker';
import { User } from '../../../users/entities/user.entity';
import { DataTemplate } from '../interfaces/data-template.interface';
import { stellarAddress, pastDate } from '../utils/realistic-data';
import { providerBio } from '../utils/faker-extensions';

export class UserGenerator implements DataTemplate<Partial<User>> {
  generate(overrides: Partial<User> = {}): Partial<User> {
    return {
      id: faker.string.uuid(),
      username: faker.internet.username().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      email: faker.internet.email().toLowerCase(),
      walletAddress: stellarAddress(),
      displayName: faker.person.fullName(),
      bio: providerBio(),
      isActive: faker.datatype.boolean({ probability: 0.9 }),
      reputationScore: faker.number.int({ min: 0, max: 1000 }),
      lastLoginAt: pastDate(30),
      createdAt: pastDate(365),
      updatedAt: pastDate(7),
      ...overrides,
    };
  }

  generateMany(count: number, overrides: Partial<User> = {}): Partial<User>[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }
}
