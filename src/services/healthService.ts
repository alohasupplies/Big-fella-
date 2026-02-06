import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { Run, RunType } from '../types';
import { runQuery, getFirst, getAll } from '../database/database';

// HealthKit types - imported conditionally for iOS only
let Healthkit: any = null;
let HKQuantityTypeIdentifier: any = null;
let HKWorkoutActivityType: any = null;
let HKWorkoutTypeIdentifier: string | null = null;

if (Platform.OS === 'ios') {
  try {
    const hk = require('@kingstinct/react-native-healthkit');
    Healthkit = hk.default;
    HKQuantityTypeIdentifier = hk.HKQuantityTypeIdentifier;
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
    if (!isAvailable) return false;

    // Request authorization for workout data
    await Healthkit.requestAuthorization([HKWorkoutTypeIdentifier], []);
    
    // For this version, assume authorization was granted if no error was thrown
    return true;
  } catch (error) {
    console.error('Failed to request HealthKit permissions:', error);
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
  daysBack: number = 30
): Promise<HealthSyncResult> => {
  if (!isHealthKitAvailable()) {
    return { imported: 0, skipped: 0, errors: 0 };
  }

  const result: HealthSyncResult = { imported: 0, skipped: 0, errors: 0 };

  try {
    const now = new Date();
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Query HealthKit for running workouts
    const workouts = await Healthkit.queryWorkouts({
      from: startDate,
      to: now,
      energyUnit: 'kcal',
      distanceUnit: 'm',
    });

    console.log('HealthKit workouts found:', workouts?.length || 0);
    console.log('Workout details:', workouts);

    if (!workouts || workouts.length === 0) {
      return result;
    }

    for (const workout of workouts) {
      try {
        console.log('Processing workout:', {
          activityType: workout.workoutActivityType,
          runningType: HKWorkoutActivityType.running,
          walkingType: HKWorkoutActivityType.walking,
          distance: workout.totalDistance
        });
        
        // Only import running workouts
        const activityType = workout.workoutActivityType;
        if (
          activityType !== HKWorkoutActivityType.running &&
          activityType !== HKWorkoutActivityType.walking
        ) {
          console.log('Skipping workout - not running/walking:', activityType);
          continue;
        }

        // Only count actual running (skip walking unless distance > 1 mile)
        // totalDistance may be a number or an object like { quantity: number, unit: string }
        const rawDistance = workout.totalDistance;
        const distanceMeters = typeof rawDistance === 'object' && rawDistance !== null
          ? rawDistance.quantity
          : (rawDistance || 0);
        if (activityType === HKWorkoutActivityType.walking && distanceMeters < 1609) {
          continue;
        }

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

        const runType: RunType = activityType === HKWorkoutActivityType.walking
          ? 'walk'
          : classifyRunType(paceMinPerMile, durationSeconds);
        const runDate = startTime.toISOString().split('T')[0];

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
