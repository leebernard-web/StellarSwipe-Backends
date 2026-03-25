import { User } from '../../../users/entities/user.entity';
import { UserGenerator } from '../generators/user-generator';

const generator = new UserGenerator();

export const UserFactory = {
  build: (overrides: Partial<User> = {}): Partial<User> => generator.generate(overrides),
  buildMany: (count: number, overrides: Partial<User> = {}): Partial<User>[] => generator.generateMany(count, overrides),
  buildProvider: (overrides: Partial<User> = {}): Partial<User> =>
    generator.generate({ reputationScore: 500, isActive: true, ...overrides }),
  buildInactive: (overrides: Partial<User> = {}): Partial<User> =>
    generator.generate({ isActive: false, ...overrides }),
};
