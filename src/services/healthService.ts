import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { RunType } from '../types';
import { runQuery, getFirst } from '../database/database';

// HealthKit types - imported conditionally for iOS only
let Healthkit: any = null;
let HKWorkoutActivityType: any = null;
let HKWorkoutTypeIdentifier: string | null = null;

if (Platform.OS === 'ios') {
  try {
    const hk = require('@kingstinct/react-native-healthkit');
    Healthkit = hk.default;
    HKWorkoutActivityType = hk.HKWorkoutActivityType;
    HKWorkoutTypeIdentifier = hk.HKWorkoutTypeIdentifier ?? 'HKWorkoutTypeIdentifier';
  } catch (e) {
    console.warn('HealthKit not available:', e);
  }
}

export const isHealthKitAvailable = (): boolean => {
  return Platform.OS === 'ios' && Healthkit !== null;
};

export const requestHealthKitPermissions = async (): Promise<boolean> => {
  if (!isHealthKitAvailable()) return false;

  try {
    const isAvailable = await Healthkit.isHealthDataAvailable();
    console.log('[HealthKit] isHealthDataAvailable:', isAvailable);
    if (!isAvailable) return false;

    console.log('[HealthKit] Requesting authorization with read:', [HKWorkoutTypeIdentifier]);
    // Request authorization for workout data
    await Healthkit.requestAuthorization([HKWorkoutTypeIdentifier], []);
    console.log('[HealthKit] Authorization request completed successfully');
    
    // For this version, assume authorization was granted if no error was thrown
    return true;
  } catch (error) {
    console.error('[HealthKit] Failed to request permissions:', error);
    return false;
  }
};

// Check if a HealthKit workout has already been synced
const isWorkoutSynced = async (healthKitId: string): Promise<boolean> => {
  const result = await getFirst<{ count: number }>(
    'SELECT COUNT(*) as count FROM synced_health_runs WHERE healthKitId = ?',
    [healthKitId]
  );
  return (result?.count || 0) > 0;
};

// Mark a workout as synced
const markWorkoutSynced = async (healthKitId: string, runId: string): Promise<void> => {
  await runQuery(
    'INSERT INTO synced_health_runs (id, healthKitId, runId, syncedAt) VALUES (?, ?, ?, ?)',
    [uuidv4(), healthKitId, runId, new Date().toISOString()]
  );
};

// Classify run type based on pace (min/mile)
const classifyRunType = (paceMinPerMile: number, durationSeconds: number): RunType => {
  if (durationSeconds > 3600 && paceMinPerMile > 8) return 'long';
  if (paceMinPerMile < 7) return 'tempo';
  if (paceMinPerMile > 10) return 'recovery';
  return 'easy';
};

// Convert meters to miles
const metersToMiles = (meters: number): number => meters / 1609.344;

// Convert meters to kilometers
const metersToKm = (meters: number): number => meters / 1000;

export interface HealthSyncResult {
  imported: number;
  skipped: number;
  errors: number;
}

// Fetch running workouts from HealthKit and import them
export const syncRunsFromHealthKit = async (
  distanceUnit: 'miles' | 'km' = 'miles',
  daysBack: number = 30,
  incremental: boolean = false,
  fromDate?: Date,
  toDate?: Date
): Promise<HealthSyncResult> => {
  if (!isHealthKitAvailable()) {
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const result: HealthSyncResult = { imported: 0, skipped: 0, errors: 0 };

  try {
    const now = toDate || new Date();
    let startDate = fromDate || new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // For incremental syncs, only query from last sync time (with a small overlap buffer)
    if (incremental && !fromDate) {
      const lastSync = await getLastSyncTime();
      if (lastSync) {
        const lastSyncDate = new Date(lastSync);
        // Go back 1 hour from last sync to catch any workouts that may have been
        // in-progress during the previous sync
        const bufferDate = new Date(lastSyncDate.getTime() - 60 * 60 * 1000);
        if (bufferDate > startDate) {
          startDate = bufferDate;
        }
      }
    }

    // Query HealthKit for running workouts
    console.log('[HealthKit] Querying workouts from', startDate.toISOString(), 'to', now.toISOString(), '(daysBack:', daysBack, ', incremental:', incremental, ')');
    
    let workouts;
    try {
      workouts = await Healthkit.queryWorkouts({
        from: startDate,
        to: now,
        energyUnit: 'kcal',
        distanceUnit: 'm',
      });
    } catch (queryError) {
      console.error('[HealthKit] queryWorkouts threw error:', queryError);
      throw queryError;
    }

    console.log('[HealthKit] Workouts found:', workouts?.length || 0);
    if (workouts && workouts.length > 0) {
      console.log('[HealthKit] First workout sample:', JSON.stringify(workouts[0]));
    }

    if (!workouts || workouts.length === 0) {
      return result;
    }

    for (const workout of workouts) {
      try {
        console.log('Processing workout:', {
          activityType: workout.workoutActivityType,
          runningType: HKWorkoutActivityType.running,
          distance: workout.totalDistance
        });
        
        // Only import running workouts (skip walks entirely)
        const activityType = workout.workoutActivityType;
        if (activityType !== HKWorkoutActivityType.running) {
          console.log('Skipping workout - not running:', activityType);
          continue;
        }

        // totalDistance may be a number or an object like { quantity: number, unit: string }
        const rawDistance = workout.totalDistance;
        const distanceMeters = typeof rawDistance === 'object' && rawDistance !== null
          ? rawDistance.quantity
          : (rawDistance || 0);

        const workoutId = workout.uuid || `hk_${workout.startDate}`;

        // Check if already synced
        if (await isWorkoutSynced(workoutId)) {
          result.skipped++;
          continue;
        }

        // Calculate run data
        const distance = distanceUnit === 'miles'
          ? metersToMiles(distanceMeters)
          : metersToKm(distanceMeters);

        if (distance < 0.1) {
          result.skipped++;
          continue;
        }

        const startTime = new Date(workout.startDate);
        const endTime = new Date(workout.endDate);
        const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

        if (durationSeconds <= 0) {
          result.skipped++;
          continue;
        }

        const pace = (durationSeconds / 60) / distance; // min per unit
        const paceMinPerMile = distanceUnit === 'miles'
          ? pace
          : pace * 1.60934; // convert min/km to min/mile for classification

        const runType: RunType = classifyRunType(paceMinPerMile, durationSeconds);
        const runDate = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}-${String(startTime.getDate()).padStart(2, '0')}`;

        // Insert the run into the database
        const runId = uuidv4();
        const now_iso = new Date().toISOString();

        await runQuery(
          `INSERT INTO runs (id, date, distance, duration, pace, routeName, runType, weather, notes, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            runId,
            runDate,
            Math.round(distance * 100) / 100,
            durationSeconds,
            Math.round(pace * 100) / 100,
            null,
            runType,
            null,
            'Synced from Apple Health',
            now_iso,
            now_iso,
          ]
        );

        // Mark as synced to prevent duplicates
        await markWorkoutSynced(workoutId, runId);

        // Update streak
        const { updateStreak } = require('./runService');
        await updateStreak(runDate);

        result.imported++;
      } catch (error) {
        console.error('Error importing workout:', error);
        result.errors++;
      }
    }
  } catch (error) {
    console.error('Failed to sync from HealthKit:', error);
    result.errors++;
  }

  return result;
};

// Sync a specific month from HealthKit (for on-demand calendar backfill)
export const syncMonthFromHealthKit = async (
  year: number,
  month: number,
  distanceUnit: 'miles' | 'km' = 'miles'
): Promise<HealthSyncResult> => {
  if (!isHealthKitAvailable()) {
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  // Reuse the main sync logic with explicit date range
  return syncRunsFromHealthKit(distanceUnit, 0, false, from, to);
};

// Clear all synced health runs and re-import
export const clearAndResyncFromHealthKit = async (
  distanceUnit: 'miles' | 'km' = 'miles',
  daysBack: number = 365
): Promise<HealthSyncResult> => {
  // Delete all runs that were synced from Apple Health
  await runQuery(
    `DELETE FROM runs WHERE notes = 'Synced from Apple Health'`
  );
  // Clear the sync tracking table
  await runQuery('DELETE FROM synced_health_runs');
  // Re-import with correct classification
  return syncRunsFromHealthKit(distanceUnit, daysBack);
};

// Get last sync timestamp
export const getLastSyncTime = async (): Promise<string | null> => {
  const result = await getFirst<{ syncedAt: string }>(
    'SELECT syncedAt FROM synced_health_runs ORDER BY syncedAt DESC LIMIT 1'
  );
  return result?.syncedAt || null;
};

// Get count of synced runs
export const getSyncedRunCount = async (): Promise<number> => {
  const result = await getFirst<{ count: number }>(
    'SELECT COUNT(*) as count FROM synced_health_runs'
  );
  return result?.count || 0;
};

// Quick incremental sync - only fetches workouts since last sync
export const syncRecentFromHealthKit = async (
  distanceUnit: 'miles' | 'km' = 'miles'
): Promise<HealthSyncResult> => {
  return syncRunsFromHealthKit(distanceUnit, 30, true);
};

// Subscribe to HealthKit workout changes for real-time updates
// Returns an unsubscribe function, or null if not available
export const subscribeToWorkoutChanges = (
  onNewWorkout: () => void
): (() => void) | null => {
  if (!isHealthKitAvailable() || !Healthkit || !HKWorkoutTypeIdentifier) {
    return null;
  }

  try {
    // Use HealthKit's anchor-based observation to detect new workouts
    const subscription = Healthkit.subscribeToChanges(
      HKWorkoutTypeIdentifier,
      () => {
        onNewWorkout();
      }
    );

    // Return unsubscribe function
    if (subscription && typeof subscription === 'object' && subscription.remove) {
      return () => subscription.remove();
    }
    if (typeof subscription === 'function') {
      return subscription;
    }
    // If the library returns a promise or subscription identifier, wrap cleanup
    return () => {
      // Best-effort cleanup
    };
  } catch (error) {
    console.warn('Could not subscribe to HealthKit workout changes:', error);
    return null;
  }
};
