import type { AppConfig } from '../../value-objects/AppConfig';

export interface IAppConfigRepository {
  get(): Promise<AppConfig>;
  set(config: AppConfig): Promise<void>;
  update(updater: (config: AppConfig) => AppConfig): Promise<AppConfig>;
}
