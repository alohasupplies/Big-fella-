import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import {
  isHealthKitAvailable,
  syncRecentFromHealthKit,
  subscribeToWorkoutChanges,
  HealthSyncResult,
} from '../services/healthService';

interface UseHealthSyncOptions {
  onSyncStart?: () => void;
  onSyncComplete?: (result: HealthSyncResult) => void;
  onSyncError?: (error: unknown) => void;
}

/**
 * Hook that manages dynamic Apple Health workout syncing.
 *
 * - Performs an incremental sync when the app returns from background
 * - Subscribes to HealthKit workout change notifications
 * - Provides a manual triggerSync function for pull-to-refresh / screen focus
 * - Debounces rapid sync triggers to avoid redundant queries
 */
export const useHealthSync = (options: UseHealthSyncOptions = {}) => {
  const { settings } = useSettings();

  // Store callbacks in refs to avoid re-creating performSync on every render
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const isSyncing = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncTime = useRef<number>(0);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Minimum interval between syncs (in ms) to avoid hammering HealthKit
  const MIN_SYNC_INTERVAL = 30_000; // 30 seconds
  const SYNC_TIMEOUT = 15_000; // 15 second safety timeout

  const performSync = useCallback(async () => {
    if (!settings.healthSyncEnabled || !isHealthKitAvailable()) return;
    if (isSyncing.current) return;

    // Throttle: don't sync more than once per MIN_SYNC_INTERVAL
    const now = Date.now();
    if (now - lastSyncTime.current < MIN_SYNC_INTERVAL) return;

    isSyncing.current = true;
    lastSyncTime.current = now;
    callbacksRef.current.onSyncStart?.();

    // Safety timeout: if sync hangs, force-clear the syncing state
    syncTimeout.current = setTimeout(() => {
      if (isSyncing.current) {
        isSyncing.current = false;
        callbacksRef.current.onSyncError?.('Sync timed out');
      }
    }, SYNC_TIMEOUT);

    try {
      const result = await syncRecentFromHealthKit(settings.distanceUnit);
      callbacksRef.current.onSyncComplete?.(result);
    } catch (error) {
      console.error('Health sync failed:', error);
      callbacksRef.current.onSyncError?.(error);
    } finally {
      isSyncing.current = false;
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
        syncTimeout.current = null;
      }
    }
  }, [settings.healthSyncEnabled, settings.distanceUnit]);

  // Debounced sync for rapid-fire triggers (e.g. HealthKit observer firing multiple times)
  const debouncedSync = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      performSync();
    }, 1000);
  }, [performSync]);

  // Subscribe to HealthKit workout changes
  useEffect(() => {
    if (!settings.healthSyncEnabled || !isHealthKitAvailable()) {
      // Clean up existing subscription if sync was disabled
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    const unsubscribe = subscribeToWorkoutChanges(() => {
      debouncedSync();
    });
    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [settings.healthSyncEnabled, debouncedSync]);

  // Sync when app returns from background
  useEffect(() => {
    if (!settings.healthSyncEnabled) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        performSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [settings.healthSyncEnabled, performSync]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
      }
    };
  }, []);

  return {
    triggerSync: performSync,
  };
};
