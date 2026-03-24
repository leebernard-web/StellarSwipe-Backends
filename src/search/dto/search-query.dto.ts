import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsEnum,
  Min,
  Max,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchSortType {
  RELEVANCE = 'relevance',
  RECENT = 'recent',
  WIN_RATE = 'winRate',
}

export class DateRangeDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  from: string;

  @ApiProperty({ example: '2026-01-31' })
  @IsString()
  to: string;
}

export class SearchFiltersDto {
  @ApiPropertyOptional({
    example: ['USDC/XLM'],
    description: 'Filter by asset pairs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assetPair?: string[];

  @ApiPropertyOptional({
    type: DateRangeDto,
    description: 'Filter by date range',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  dateRange?: DateRangeDto;

  @ApiPropertyOptional({
    example: 70,
    description: 'Minimum win rate percentage',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minWinRate?: number;

  @ApiPropertyOptional({
    example: ['BUY', 'SELL'],
    description: 'Filter by signal action',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  action?: string[];

  @ApiPropertyOptional({
    example: ['provider-id'],
    description: 'Filter by provider IDs',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  providerId?: string[];
}

export class SearchQueryDto {
  @ApiProperty({ example: 'bullish USDC' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ type: SearchFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters?: SearchFiltersDto;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: SearchSortType,
    example: SearchSortType.RELEVANCE,
    default: SearchSortType.RELEVANCE,
  })
  @IsOptional()
  @IsEnum(SearchSortType)
  sort?: SearchSortType = SearchSortType.RELEVANCE;
}

export class AutocompleteQueryDto {
  @ApiProperty({ example: 'bull' })
  @IsString()
  prefix: string;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
