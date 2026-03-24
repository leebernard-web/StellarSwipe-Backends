import { ApiProperty } from '@nestjs/swagger';

export enum SearchResultType {
  SIGNAL = 'signal',
  PROVIDER = 'provider',
  CONTENT = 'content',
}

export class SearchHighlight {
  @ApiProperty()
  rationale?: string[];

  @ApiProperty()
  title?: string[];

  @ApiProperty()
  body?: string[];

  @ApiProperty()
  bio?: string[];
}

export class SearchResultItem {
  @ApiProperty({ enum: SearchResultType })
  type: SearchResultType;

  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  assetPair?: string;

  @ApiProperty({ required: false })
  action?: string;

  @ApiProperty({ required: false })
  rationale?: string;

  @ApiProperty({ required: false })
  provider?: string;

  @ApiProperty({ required: false })
  providerId?: string;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty({ required: false })
  title?: string;

  @ApiProperty({ required: false })
  body?: string;

  @ApiProperty({ required: false })
  entryPrice?: number;

  @ApiProperty({ required: false })
  winRate?: number;

  @ApiProperty()
  score: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: SearchHighlight })
  highlights: SearchHighlight;
}

export class SearchFacetBucket {
  @ApiProperty()
  key: string;

  @ApiProperty()
  count: number;
}

export class SearchFacets {
  @ApiProperty({ type: [SearchFacetBucket] })
  assetPair: SearchFacetBucket[];

  @ApiProperty({ type: [SearchFacetBucket] })
  action: SearchFacetBucket[];

  @ApiProperty({ type: [SearchFacetBucket] })
  contentType?: SearchFacetBucket[];
}

export class SearchResultDto {
  @ApiProperty()
  query: string;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: [SearchResultItem] })
  results: SearchResultItem[];

  @ApiProperty({ type: SearchFacets })
  facets: SearchFacets;

  @ApiProperty({ type: [String] })
  suggestions: string[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  took: number;
}

export class AutocompleteResultDto {
  @ApiProperty({ type: [String] })
  suggestions: string[];
}
