/**
 * Settings Use Cases Port
 *
 * Defines the contract for settings operations.
 */

export interface SettingDTO {
  key: string;
  value: string;
  updatedAt: number; // Unix timestamp
}

export interface IGetSettingUseCase {
  execute(request: { key: string }): Promise<{ value: string | null }>;
}

export interface ISetSettingUseCase {
  execute(request: { key: string; value: string }): Promise<void>;
}

export interface IGetAllSettingsUseCase {
  execute(): Promise<{ settings: SettingDTO[] }>;
}

/**
 * Aggregated settings use cases interface for DI container
 */
export interface ISettingsUseCases {
  get: IGetSettingUseCase;
  set: ISetSettingUseCase;
  getAll: IGetAllSettingsUseCase;
}
