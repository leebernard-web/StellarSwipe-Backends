import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('search_queries')
@Index(['query'])
@Index(['createdAt'])
export class SearchQuery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'int', default: 0 })
  resultsCount: number;

  @Column({ type: 'int', default: 0 })
  took: number;

  @Column({ type: 'uuid', nullable: true })
  clickedResult: string | null;

  @Column({ type: 'int', nullable: true })
  clickedPosition: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('search_analytics')
@Index(['date'])
export class SearchAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  date: Date;

  @Column({ type: 'int', default: 0 })
  totalSearches: number;

  @Column({ type: 'int', default: 0 })
  uniqueQueries: number;

  @Column({ type: 'float', default: 0 })
  avgResultsCount: number;

  @Column({ type: 'float', default: 0 })
  avgResponseTime: number;

  @Column({ type: 'int', default: 0 })
  zeroResultSearches: number;

  @Column({ type: 'simple-array', nullable: true })
  popularQueries: string[];

  @CreateDateColumn()
  createdAt: Date;
}
