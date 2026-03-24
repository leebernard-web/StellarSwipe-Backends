import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  PatternType,
  PatternCategory,
  PatternDirection,
  PatternTimeframe,
} from '../interfaces/pattern.interface';

export enum PatternOutcome {
  PENDING = 'PENDING',         // Breakout / target not yet reached
  TARGET_HIT = 'TARGET_HIT',   // Price reached the projected target
  STOP_HIT = 'STOP_HIT',       // Price hit the stop-loss level
  INVALIDATED = 'INVALIDATED', // Pattern broken before completion
  EXPIRED = 'EXPIRED',         // Lookforward window elapsed with no conclusion
}

@Entity('ml_detected_patterns')
@Index(['assetPair', 'detectedAt'])
@Index(['patternType', 'direction'])
@Index(['assetPair', 'patternType', 'outcome'])
@Index(['confidence'])
export class DetectedPattern {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** e.g. 'XLM/USDC' */
  @Column({ name: 'asset_pair', type: 'varchar', length: 50 })
  assetPair!: string;

  @Column({
    name: 'pattern_type',
    type: 'enum',
    enum: PatternType,
  })
  patternType!: PatternType;

  @Column({ type: 'enum', enum: PatternCategory })
  category!: PatternCategory;

  @Column({ type: 'enum', enum: PatternDirection })
  direction!: PatternDirection;

  @Column({ type: 'enum', enum: PatternTimeframe })
  timeframe!: PatternTimeframe;

  /** Composite confidence score 0-1 */
  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence!: number;

  /** First candle of the pattern (UTC) */
  @Column({ name: 'pattern_start', type: 'timestamp with time zone' })
  patternStart!: Date;

  /** Last candle of the pattern (UTC) */
  @Column({ name: 'pattern_end', type: 'timestamp with time zone' })
  patternEnd!: Date;

  /** Number of candles spanned */
  @Column({ name: 'pattern_width', type: 'int' })
  patternWidth!: number;

  /** Price at the start of the pattern window */
  @Column({ name: 'start_price', type: 'decimal', precision: 18, scale: 8 })
  startPrice!: number;

  /** Price at the end of the pattern window */
  @Column({ name: 'end_price', type: 'decimal', precision: 18, scale: 8 })
  endPrice!: number;

  /** Pattern height (price range top - bottom) */
  @Column({ name: 'pattern_height', type: 'decimal', precision: 18, scale: 8 })
  patternHeight!: number;

  /** Projected breakout price target (measured-move) */
  @Column({ name: 'price_target', type: 'decimal', precision: 18, scale: 8, nullable: true })
  priceTarget!: number | null;

  /** Suggested stop-loss level */
  @Column({ name: 'stop_loss', type: 'decimal', precision: 18, scale: 8, nullable: true })
  stopLoss!: number | null;

  /** Price level that would confirm the breakout */
  @Column({ name: 'breakout_level', type: 'decimal', precision: 18, scale: 8, nullable: true })
  breakoutLevel!: number | null;

  /** Human-readable description of the pattern and its implications */
  @Column({ type: 'text' })
  description!: string;

  /** Serialised PatternGeometry (pivots, trend lines, key levels) */
  @Column({ type: 'jsonb' })
  geometry!: Record<string, unknown>;

  /** Raw OHLCV data window used for detection */
  @Column({ name: 'candle_data', type: 'jsonb' })
  candleData!: unknown[];

  @Column({
    type: 'enum',
    enum: PatternOutcome,
    default: PatternOutcome.PENDING,
  })
  outcome!: PatternOutcome;

  /** Actual price when the outcome was determined */
  @Column({ name: 'outcome_price', type: 'decimal', precision: 18, scale: 8, nullable: true })
  outcomePrice!: number | null;

  /** UTC timestamp when outcome was settled */
  @Column({ name: 'outcome_at', type: 'timestamp with time zone', nullable: true })
  outcomeAt!: Date | null;

  /** Actual % price move from breakout to resolution */
  @Column({ name: 'actual_move_pct', type: 'decimal', precision: 10, scale: 4, nullable: true })
  actualMovePct!: number | null;

  /** UTC when the pattern was first detected */
  @Column({ name: 'detected_at', type: 'timestamp with time zone' })
  detectedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
