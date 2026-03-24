import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDetectedPatternsTable1705000000203 implements MigrationInterface {
  name = 'CreateDetectedPatternsTable1705000000203';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TYPE "ml_pattern_type_enum" AS ENUM (
        'DOJI', 'HAMMER', 'INVERTED_HAMMER', 'SHOOTING_STAR', 'HANGING_MAN',
        'BULLISH_ENGULFING', 'BEARISH_ENGULFING', 'MORNING_STAR', 'EVENING_STAR',
        'HARAMI_BULLISH', 'HARAMI_BEARISH', 'THREE_WHITE_SOLDIERS', 'THREE_BLACK_CROWS',
        'UPTREND_CHANNEL', 'DOWNTREND_CHANNEL', 'HORIZONTAL_CHANNEL',
        'HEAD_AND_SHOULDERS', 'INVERSE_HEAD_AND_SHOULDERS',
        'DOUBLE_TOP', 'DOUBLE_BOTTOM', 'TRIPLE_TOP', 'TRIPLE_BOTTOM',
        'ASCENDING_TRIANGLE', 'DESCENDING_TRIANGLE', 'SYMMETRIC_TRIANGLE',
        'RECTANGLE', 'FLAG_BULL', 'FLAG_BEAR', 'PENNANT',
        'RISING_WEDGE', 'FALLING_WEDGE',
        'SUPPORT_LEVEL', 'RESISTANCE_LEVEL'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "ml_pattern_category_enum" AS ENUM (
        'CANDLESTICK', 'TREND', 'REVERSAL', 'CONSOLIDATION', 'SUPPORT_RESISTANCE'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "ml_pattern_direction_enum" AS ENUM (
        'BULLISH', 'BEARISH', 'NEUTRAL'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "ml_pattern_timeframe_enum" AS ENUM (
        'MICRO', 'SHORT', 'MEDIUM', 'LONG'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "ml_pattern_outcome_enum" AS ENUM (
        'PENDING', 'TARGET_HIT', 'STOP_HIT', 'INVALIDATED', 'EXPIRED'
      )
    `);

    // ── ml_detected_patterns ─────────────────────────────────────────────────

    await queryRunner.createTable(
      new Table({
        name: 'ml_detected_patterns',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'asset_pair', type: 'varchar', length: '50' },
          { name: 'pattern_type', type: 'enum', enumName: 'ml_pattern_type_enum' },
          { name: 'category', type: 'enum', enumName: 'ml_pattern_category_enum' },
          { name: 'direction', type: 'enum', enumName: 'ml_pattern_direction_enum' },
          { name: 'timeframe', type: 'enum', enumName: 'ml_pattern_timeframe_enum' },
          { name: 'confidence', type: 'decimal', precision: 5, scale: 4 },
          { name: 'pattern_start', type: 'timestamp with time zone' },
          { name: 'pattern_end', type: 'timestamp with time zone' },
          { name: 'pattern_width', type: 'int' },
          { name: 'start_price', type: 'decimal', precision: 18, scale: 8 },
          { name: 'end_price', type: 'decimal', precision: 18, scale: 8 },
          { name: 'pattern_height', type: 'decimal', precision: 18, scale: 8 },
          { name: 'price_target', type: 'decimal', precision: 18, scale: 8, isNullable: true },
          { name: 'stop_loss', type: 'decimal', precision: 18, scale: 8, isNullable: true },
          { name: 'breakout_level', type: 'decimal', precision: 18, scale: 8, isNullable: true },
          { name: 'description', type: 'text' },
          { name: 'geometry', type: 'jsonb' },
          { name: 'candle_data', type: 'jsonb' },
          {
            name: 'outcome',
            type: 'enum',
            enumName: 'ml_pattern_outcome_enum',
            default: "'PENDING'",
          },
          { name: 'outcome_price', type: 'decimal', precision: 18, scale: 8, isNullable: true },
          { name: 'outcome_at', type: 'timestamp with time zone', isNullable: true },
          { name: 'actual_move_pct', type: 'decimal', precision: 10, scale: 4, isNullable: true },
          { name: 'detected_at', type: 'timestamp with time zone' },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ml_detected_patterns',
      new TableIndex({ name: 'IDX_ml_patterns_asset_detected', columnNames: ['asset_pair', 'detected_at'] }),
    );

    await queryRunner.createIndex(
      'ml_detected_patterns',
      new TableIndex({ name: 'IDX_ml_patterns_type_direction', columnNames: ['pattern_type', 'direction'] }),
    );

    await queryRunner.createIndex(
      'ml_detected_patterns',
      new TableIndex({ name: 'IDX_ml_patterns_outcome', columnNames: ['asset_pair', 'pattern_type', 'outcome'] }),
    );

    await queryRunner.createIndex(
      'ml_detected_patterns',
      new TableIndex({ name: 'IDX_ml_patterns_confidence', columnNames: ['confidence'] }),
    );

    // ── ml_pattern_history ────────────────────────────────────────────────────

    await queryRunner.createTable(
      new Table({
        name: 'ml_pattern_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'asset_pair', type: 'varchar', length: '50' },
          { name: 'pattern_type', type: 'enum', enumName: 'ml_pattern_type_enum' },
          { name: 'direction', type: 'enum', enumName: 'ml_pattern_direction_enum' },
          { name: 'total_detected', type: 'int', default: 0 },
          { name: 'total_resolved', type: 'int', default: 0 },
          { name: 'target_hits', type: 'int', default: 0 },
          { name: 'stop_hits', type: 'int', default: 0 },
          { name: 'invalidated', type: 'int', default: 0 },
          { name: 'success_rate', type: 'decimal', precision: 5, scale: 4, isNullable: true },
          { name: 'avg_move_pct', type: 'decimal', precision: 10, scale: 4, isNullable: true },
          { name: 'avg_confidence', type: 'decimal', precision: 5, scale: 4, isNullable: true },
          { name: 'avg_bars_to_resolution', type: 'decimal', precision: 6, scale: 1, isNullable: true },
          { name: 'rolling_history', type: 'jsonb', default: "'[]'" },
          { name: 'created_at', type: 'timestamp with time zone', default: 'now()' },
          { name: 'updated_at', type: 'timestamp with time zone', default: 'now()' },
        ],
        uniques: [
          { name: 'UQ_ml_pattern_history_triple', columnNames: ['asset_pair', 'pattern_type', 'direction'] },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ml_pattern_history',
      new TableIndex({ name: 'IDX_ml_pattern_history_pair_type', columnNames: ['asset_pair', 'pattern_type'] }),
    );

    await queryRunner.createIndex(
      'ml_pattern_history',
      new TableIndex({ name: 'IDX_ml_pattern_history_success_rate', columnNames: ['success_rate'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ml_pattern_history', true);
    await queryRunner.dropTable('ml_detected_patterns', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "ml_pattern_outcome_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ml_pattern_timeframe_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ml_pattern_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ml_pattern_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ml_pattern_type_enum"`);
  }
}
