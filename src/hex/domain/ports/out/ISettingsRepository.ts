/**
 * Settings Repository Port
 *
 * Defines the contract for settings persistence operations.
 */

export interface SettingProps {
  key: string;
  value: string;
  updatedAt: Date;
}

export interface ISettingsRepository {
  /**
   * Get a setting by key
   */
  get(key: string): Promise<SettingProps | null>;

  /**
   * Set a setting (create or update)
   */
  set(key: string, value: string): Promise<SettingProps>;

  /**
   * Get all settings
   */
  getAll(): Promise<SettingProps[]>;

  /**
   * Delete a setting by key
   */
  delete(key: string): Promise<void>;
}
