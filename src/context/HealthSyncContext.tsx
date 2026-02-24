import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSettings } from './SettingsContext';
import {
  isHealthKitAvailable,
  syncRecentFromHealthKit,
  subscribeToWorkoutChanges,
} from '../services/healthService';

interface HealthSyncContextValue {
  /** Increments each time a sync completes with new data — watch this to reload */
  syncVersion: number;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Manually trigger a sync (e.g. pull-to-refresh) */
  triggerSync: () => void;
}

const HealthSyncContext = createContext<HealthSyncContextValue>({
  syncVersion: 0,
  isSyncing: false,
  triggerSync: () => {},
});

export const useHealthSyncContext = () => useContext(HealthSyncContext);

export const HealthSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [syncVersion, setSyncVersion] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncingRef = useRef(false);
  const lastSyncTime = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const MIN_SYNC_INTERVAL = 30_000; // 30 seconds
  const SYNC_TIMEOUT = 15_000;

  const performSync = useCallback(async () => {
    if (!settings.healthSyncEnabled || !isHealthKitAvailable()) return;
    if (syncingRef.current) return;

    const now = Date.now();
    if (now - lastSyncTime.current < MIN_SYNC_INTERVAL) return;

    syncingRef.current = true;
    lastSyncTime.current = now;
    setIsSyncing(true);

    syncTimeout.current = setTimeout(() => {
      if (syncingRef.current) {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    }, SYNC_TIMEOUT);

    try {
      const result = await syncRecentFromHealthKit(settings.distanceUnit);
      // Bump version so all screens know to reload
      if (result.imported > 0) {
        setSyncVersion((v) => v + 1);
      }
    } catch (error) {
      console.error('[HealthSync] Background sync failed:', error);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
        syncTimeout.current = null;
      }
    }
  }, [settings.healthSyncEnabled, settings.distanceUnit]);

  const debouncedSync = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => performSync(), 1000);
  }, [performSync]);

  // Sync on app launch (when provider mounts and sync is enabled)
  useEffect(() => {
    if (settings.healthSyncEnabled && isHealthKitAvailable()) {
      performSync();
    }
  }, [settings.healthSyncEnabled]);

  // Sync when app returns from background
  useEffect(() => {
    if (!settings.healthSyncEnabled) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        performSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [settings.healthSyncEnabled, performSync]);

  // Subscribe to HealthKit workout change notifications
  useEffect(() => {
    if (!settings.healthSyncEnabled || !isHealthKitAvailable()) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    const unsubscribe = subscribeToWorkoutChanges(() => debouncedSync());
    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [settings.healthSyncEnabled, debouncedSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
    };
  }, []);

  return (
    <HealthSyncContext.Provider value={{ syncVersion, isSyncing, triggerSync: performSync }}>
      {children}
    </HealthSyncContext.Provider>
  );
};
