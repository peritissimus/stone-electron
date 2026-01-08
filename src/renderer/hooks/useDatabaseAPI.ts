/**
 * Database API Hook - React hook for database operations
 */

import { useCallback, useState } from 'react';
import { databaseAPI } from '@renderer/api';
import { logger } from '@renderer/utils/logger';
import type { DatabaseStatus, BackupResult, VacuumResult, IntegrityResult } from '@shared/types';

interface UseDatabaseAPIState {
  status: DatabaseStatus | null;
  loading: boolean;
  error: string | null;
}

export function useDatabaseAPI() {
  const [state, setState] = useState<UseDatabaseAPIState>({
    status: null,
    loading: false,
    error: null,
  });

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const getStatus = useCallback(async (): Promise<DatabaseStatus | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await databaseAPI.getStatus();
      if (response.success && response.data) {
        setState((s) => ({ ...s, status: response.data!, loading: false }));
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to get database status');
        setState((s) => ({ ...s, loading: false }));
        return null;
      }
    } catch (err) {
      logger.error('[useDatabaseAPI.getStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get database status');
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, [setError]);

  const backup = useCallback(async (path?: string): Promise<BackupResult | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await databaseAPI.backup(path);
      setState((s) => ({ ...s, loading: false }));
      if (response.success && response.data) {
        logger.info('[useDatabaseAPI.backup] Backup created', { path: response.data.path });
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to create backup');
        return null;
      }
    } catch (err) {
      logger.error('[useDatabaseAPI.backup] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create backup');
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, [setError]);

  const vacuum = useCallback(async (): Promise<VacuumResult | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await databaseAPI.vacuum();
      setState((s) => ({ ...s, loading: false }));
      if (response.success && response.data) {
        logger.info('[useDatabaseAPI.vacuum] Database optimized', response.data);
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to optimize database');
        return null;
      }
    } catch (err) {
      logger.error('[useDatabaseAPI.vacuum] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to optimize database');
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, [setError]);

  const checkIntegrity = useCallback(async (): Promise<IntegrityResult | null> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await databaseAPI.checkIntegrity();
      setState((s) => ({ ...s, loading: false }));
      if (response.success && response.data) {
        logger.info('[useDatabaseAPI.checkIntegrity] Integrity check complete', response.data);
        return response.data;
      } else {
        setError(response.error?.message || 'Failed to check integrity');
        return null;
      }
    } catch (err) {
      logger.error('[useDatabaseAPI.checkIntegrity] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to check integrity');
      setState((s) => ({ ...s, loading: false }));
      return null;
    }
  }, [setError]);

  return {
    // State
    status: state.status,
    loading: state.loading,
    error: state.error,
    // Actions
    getStatus,
    backup,
    vacuum,
    checkIntegrity,
    clearError: () => setError(null),
  };
}
