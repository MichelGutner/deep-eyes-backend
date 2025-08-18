import {
  AcknowledgedResponseBase,
  AggregationsAggregate,
  SearchRequest,
  SearchResponse,
  WriteResponseBase,
} from '@elastic/elasticsearch/lib/api/types';

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
};
