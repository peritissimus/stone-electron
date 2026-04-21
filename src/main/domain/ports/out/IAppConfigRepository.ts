import type { AppConfig } from '@shared/types/settings';

export interface IAppConfigRepository {
  get(): Promise<AppConfig>;
  set(config: AppConfig): Promise<void>;
  update(updater: (config: AppConfig) => AppConfig): Promise<AppConfig>;
}
