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

export interface ISettingsUseCases {
  /**
   * Get a setting by key
   */
  get(key: string): Promise<{ value: string | null }>;

  /**
   * Set a setting (create or update)
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Get all settings
   */
  getAll(): Promise<{ settings: SettingDTO[] }>;
}
