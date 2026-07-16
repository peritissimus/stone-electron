export type ExternalSourceStatus = 'connected' | 'denied' | 'unavailable' | 'error';

export interface ExternalSourceResult<T> {
  status: ExternalSourceStatus;
  data: T;
  message?: string;
}
