export type DoubanErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_SUBJECT_ID'
  | 'NOT_IMPLEMENTED';

export class DoubanError extends Error {
  constructor(
    message: string,
    public code: DoubanErrorCode,
    public status?: number,
  ) {
    super(message);
    this.name = 'DoubanError';
  }
}
