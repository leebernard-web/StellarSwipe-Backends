import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { PatternType, PatternDirection } from '../interfaces/pattern.interface';

/**
 * Aggregated performance statistics for each (assetPair, patternType, direction) triple.
 * Updated by the outcome-validation job after each pattern resolves.
 *
 * Used by ConfidenceScorer to adjust the `historicalAccuracy` factor.
 */
@Entity('ml_pattern_history')
@Unique(['assetPair', 'patternType', 'direction'])
@Index(['assetPair', 'patternType'])
@Index(['successRate'])
export class PatternHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'asset_pair', type: 'varchar', length: 50 })
  assetPair!: string;

  @Column({ name: 'pattern_type', type: 'enum', enum: PatternType })
  patternType!: PatternType;

  @Column({ type: 'enum', enum: PatternDirection })
  direction!: PatternDirection;

  /** Total number of detected occurrences (including pending) */
  @Column({ name: 'total_detected', type: 'int', default: 0 })
  totalDetected!: number;

  /** Outcomes resolved so far (TARGET_HIT + STOP_HIT + INVALIDATED + EXPIRED) */
  @Column({ name: 'total_resolved', type: 'int', default: 0 })
  totalResolved!: number;

  /** Patterns that hit the projected target */
  @Column({ name: 'target_hits', type: 'int', default: 0 })
  targetHits!: number;

  /** Patterns that hit the stop-loss */
  @Column({ name: 'stop_hits', type: 'int', default: 0 })
  stopHits!: number;

  /** Patterns that were invalidated before completion */
  @Column({ name: 'invalidated', type: 'int', default: 0 })
  invalidated!: number;

  /**
   * targetHits / totalResolved (0-1).
   * Null until at least one pattern resolves.
   */
  @Column({
    name: 'success_rate',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  successRate!: number | null;

  /** Average measured price move % on target-hit patterns */
  @Column({
    name: 'avg_move_pct',
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  avgMovePct!: number | null;

  /** Average confidence score of patterns in this group */
  @Column({
    name: 'avg_confidence',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  avgConfidence!: number | null;

  /** Mean bars to resolution (or expiry) */
  @Column({ name: 'avg_bars_to_resolution', type: 'decimal', precision: 6, scale: 1, nullable: true })
  avgBarsToResolution!: number | null;

  /** Serialised 30-day rolling performance history [ { date, successRate, count } ] */
  @Column({ name: 'rolling_history', type: 'jsonb', default: '[]' })
  rollingHistory!: Array<{ date: string; successRate: number; count: number }>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt!: Date;
}
