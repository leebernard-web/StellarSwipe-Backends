import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SearchQuery,
  SearchAnalytics,
} from '../entities/search-analytics.entity';

@Injectable()
export class SearchAnalyticsService {
  private readonly logger = new Logger(SearchAnalyticsService.name);

  constructor(
    @InjectRepository(SearchQuery)
    private readonly searchQueryRepository: Repository<SearchQuery>,
    @InjectRepository(SearchAnalytics)
    private readonly searchAnalyticsRepository: Repository<SearchAnalytics>,
  ) {}

  async trackSearchQuery(
    query: string,
    userId: string | null,
    resultsCount: number,
    took: number,
  ): Promise<void> {
    try {
      const searchQuery = this.searchQueryRepository.create({
        query,
        userId,
        resultsCount,
        took,
      });
      await this.searchQueryRepository.save(searchQuery);
    } catch (error) {
      this.logger.error('Failed to track search query', error);
    }
  }

  async trackResultClick(
    queryId: string,
    resultId: string,
    resultType: string,
    position: number,
  ): Promise<void> {
    try {
      await this.searchQueryRepository.update(queryId, {
        clickedResult: resultId,
        clickedPosition: position,
      });
    } catch (error) {
      this.logger.error('Failed to track result click', error);
    }
  }

  async getPopularQueries(limit = 10): Promise<any[]> {
    return this.searchQueryRepository
      .createQueryBuilder('sq')
      .select('sq.query', 'query')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sq.query')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getSearchAnalytics(startDate: Date, endDate: Date): Promise<any> {
    const totalSearches = await this.searchQueryRepository
      .createQueryBuilder('sq')
      .where('sq.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getCount();

    const avgResultsCount = await this.searchQueryRepository
      .createQueryBuilder('sq')
      .select('AVG(sq.resultsCount)', 'avg')
      .where('sq.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    const avgResponseTime = await this.searchQueryRepository
      .createQueryBuilder('sq')
      .select('AVG(sq.took)', 'avg')
      .where('sq.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    const zeroResultSearches = await this.searchQueryRepository
      .createQueryBuilder('sq')
      .where('sq.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('sq.resultsCount = 0')
      .getCount();

    return {
      totalSearches,
      avgResultsCount: parseFloat(avgResultsCount.avg) || 0,
      avgResponseTime: parseFloat(avgResponseTime.avg) || 0,
      zeroResultSearches,
      zeroResultRate: totalSearches > 0 ? zeroResultSearches / totalSearches : 0,
    };
  }

  async getFailedQueries(limit = 10): Promise<any[]> {
    return this.searchQueryRepository
      .createQueryBuilder('sq')
      .where('sq.resultsCount = 0')
      .orderBy('sq.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async aggregateDailyAnalytics(date: Date): Promise<void> {
    try {
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const analytics = await this.getSearchAnalytics(startOfDay, endOfDay);
      const popularQueries = await this.getPopularQueries(5);

      const dailyAnalytics = this.searchAnalyticsRepository.create({
        date: startOfDay,
        totalSearches: analytics.totalSearches,
        uniqueQueries: popularQueries.length,
        avgResultsCount: analytics.avgResultsCount,
        avgResponseTime: analytics.avgResponseTime,
        zeroResultSearches: analytics.zeroResultSearches,
        popularQueries: popularQueries.map((q) => q.query),
      });

      await this.searchAnalyticsRepository.save(dailyAnalytics);
      this.logger.log(`Aggregated analytics for ${startOfDay.toISOString()}`);
    } catch (error) {
      this.logger.error('Failed to aggregate daily analytics', error);
    }
  }
}
