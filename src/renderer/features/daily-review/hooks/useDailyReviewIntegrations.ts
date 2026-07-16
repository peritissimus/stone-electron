import { useCallback } from 'react';
import { systemAPI } from '@renderer/api/settingsAPI';
import { useDailyReviewStore } from '@renderer/features/daily-review/model/dailyReviewStore';
import type { DailyReviewIntegrationSource } from '@shared/types';

export type { IntegrationLoadState } from '@renderer/features/daily-review/model/dailyReviewStore';

const AUTOMATION_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation';
const CALENDAR_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars';

export function useDailyReviewIntegrations() {
  const integrations = useDailyReviewStore((state) => state.integrations);
  const loadIntegration = useDailyReviewStore((state) => state.loadIntegration);

  const checkAccess = useCallback(
    (source: DailyReviewIntegrationSource) => loadIntegration(source),
    [loadIntegration],
  );

  const openIntegrationSettings = useCallback(async (source: DailyReviewIntegrationSource) => {
    await systemAPI.openExternal(
      source === 'calendar' ? CALENDAR_SETTINGS_URL : AUTOMATION_SETTINGS_URL,
    );
  }, []);

  return { integrations, checkAccess, openIntegrationSettings };
}
