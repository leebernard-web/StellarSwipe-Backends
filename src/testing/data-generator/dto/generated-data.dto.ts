import { User } from '../../../users/entities/user.entity';
import { Signal } from '../../../signals/entities/signal.entity';
import { Trade } from '../../../trades/entities/trade.entity';
import { Position } from '../../../portfolio/entities/position.entity';

export class GeneratedDataDto {
  users: Partial<User>[];
  signals: Partial<Signal>[];
  trades: Partial<Trade>[];
  positions: Partial<Position>[];
  meta: {
    generatedAt: Date;
    counts: { users: number; signals: number; trades: number; positions: number };
  };
}
