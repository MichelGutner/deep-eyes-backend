import {
  AcknowledgedResponseBase,
  AggregationsAggregate,
  SearchRequest,
  SearchResponse,
  WriteResponseBase,
} from '@elastic/elasticsearch/lib/api/types';

export interface LogQueryFilters {
  level?: string;
  platform?: string;
  environment?: string;
  app?: string;
  search?: string;
  fingerprint?: string;
  timeRange?: string; // e.g. '1h', '24h', '7d'
  limit?: number;
  offset?: number;
}

export interface LevelAggregation {
  level: string;
  sum: number;
}

export type ESServiceInterface = {
  createDataStream: (streamName: string) => Promise<AcknowledgedResponseBase>;
  indexDocument: <T>(
    indexName: string,
    document: T,
    id?: string,
  ) => Promise<WriteResponseBase>;
  getStreamDocuments: <T>(
    streamName: string,
    body?: SearchRequest
  ) => Promise<SearchResponse<T, Record<string, AggregationsAggregate>>>;
  getDocument: <T>(indexName: string, id: string) => Promise<any>;
  queryLogs: <T>(filters: LogQueryFilters, streamPattern?: string) => Promise<SearchResponse<T, Record<string, AggregationsAggregate>>>;
  aggregateLogsByLevel: (streamPattern?: string, timeRange?: string) => Promise<LevelAggregation[]>;
  aggregateErrors: (timeRange?: string, limit?: number) => Promise<ErrorGroup[]>;
  getErrorOccurrences: (fingerprint: string, timeRange?: string, limit?: number) => Promise<unknown[]>;
  aggregateActiveUsers: (timeRange?: string) => Promise<number>;
};

export interface ErrorGroup {
  fingerprint: string;
  errorType: string;
  message: string;
  platforms: string[];
  apps: string[];
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: 'error' | 'fatal';
  representative: Record<string, unknown>;
  hourly: number[];
}
