import { v4 as uuidv4 } from 'uuid';
import { Workout, Exercise, Set, ExerciseHistory, PersonalRecord, PRType } from '../types';
import { getAll, getFirst, runQuery } from '../database/database';

// Create a new workout
export const createWorkout = async (
  exercises: Omit<Exercise, 'id' | 'workoutId'>[],
  notes?: string,
  tags?: string[]
): Promise<Workout> => {
  const workoutId = uuidv4();
  const now = new Date().toISOString();
  const date = now.split('T')[0];

  // Calculate duration from first to last set timestamp
  let duration = 0;
  if (exercises.length > 0 && exercises[0].sets.length > 0) {
    const allTimestamps = exercises.flatMap((e) => e.sets.map((s) => new Date(s.timestamp).getTime()));
    if (allTimestamps.length > 1) {
      duration = Math.round((Math.max(...allTimestamps) - Math.min(...allTimestamps)) / 60000);
    }
  }

  // Insert workout
  await runQuery(
    `INSERT INTO workouts (id, date, duration, notes, tags, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [workoutId, date, duration, notes || null, tags?.join(',') || null, now, now]
  );

  // Insert exercises and sets
  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];
    const exerciseId = uuidv4();

    await runQuery(
      `INSERT INTO exercises (id, workoutId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        exerciseId,
        workoutId,
        exercise.exerciseLibraryId,
        exercise.exerciseName,
        exercise.muscleGroups.join(','),
        i,
        exercise.notes || null,
      ]
    );

    for (const set of exercise.sets) {
      const setId = uuidv4();
      await runQuery(
        `INSERT INTO sets (id, exerciseId, setNumber, weight, reps, rpe, isWarmup, notes, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          setId,
          exerciseId,
          set.setNumber,
          set.weight,
          set.reps,
          set.rpe || null,
          set.isWarmup ? 1 : 0,
          set.notes || null,
          set.timestamp,
        ]
      );

      // Check for personal records
      await checkAndUpdatePR(exercise.exerciseLibraryId, set.weight, set.reps, date, workoutId, setId);
    }
  }

  return getWorkoutById(workoutId) as Promise<Workout>;
};

// Get workout by ID with full details
export const getWorkoutById = async (workoutId: string): Promise<Workout | null> => {
  const workout = await getFirst<any>(
    'SELECT * FROM workouts WHERE id = ?',
    [workoutId]
  );

  if (!workout) return null;

  const exercises = await getAll<any>(
    'SELECT * FROM exercises WHERE workoutId = ? ORDER BY orderIndex',
    [workoutId]
  );

  const fullExercises: Exercise[] = [];

  for (const exercise of exercises) {
    const sets = await getAll<any>(
      'SELECT * FROM sets WHERE exerciseId = ? ORDER BY setNumber',
      [exercise.id]
    );

    fullExercises.push({
      ...exercise,
      muscleGroups: exercise.muscleGroups.split(','),
      sets: sets.map((s: any) => ({
        ...s,
        isWarmup: s.isWarmup === 1,
      })),
    });
  }

  return {
    ...workout,
    tags: workout.tags ? workout.tags.split(',') : [],
    exercises: fullExercises,
  };
};

// Get recent workouts
export const getRecentWorkouts = async (limit: number = 10): Promise<Workout[]> => {
  const workouts = await getAll<any>(
    'SELECT * FROM workouts ORDER BY date DESC, createdAt DESC LIMIT ?',
    [limit]
  );

  const fullWorkouts: Workout[] = [];

  for (const workout of workouts) {
    const full = await getWorkoutById(workout.id);
    if (full) fullWorkouts.push(full);
  }

  return fullWorkouts;
};

// Get workouts by date range
export const getWorkoutsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<Workout[]> => {
  const workouts = await getAll<any>(
    'SELECT * FROM workouts WHERE date >= ? AND date <= ? ORDER BY date DESC',
    [startDate, endDate]
  );

  const fullWorkouts: Workout[] = [];

  for (const workout of workouts) {
    const full = await getWorkoutById(workout.id);
    if (full) fullWorkouts.push(full);
  }

  return fullWorkouts;
};

// Get exercise history for a specific exercise
export const getExerciseHistory = async (
  exerciseLibraryId: string,
  limit: number = 20
): Promise<ExerciseHistory[]> => {
  const exercises = await getAll<any>(
    `SELECT e.*, w.date
     FROM exercises e
     JOIN workouts w ON e.workoutId = w.id
     WHERE e.exerciseLibraryId = ?
     ORDER BY w.date DESC
     LIMIT ?`,
    [exerciseLibraryId, limit]
  );

  const history: ExerciseHistory[] = [];

  for (const exercise of exercises) {
    const sets = await getAll<any>(
      'SELECT * FROM sets WHERE exerciseId = ? ORDER BY setNumber',
      [exercise.id]
    );

    const totalVolume = sets.reduce((sum: number, s: any) => sum + s.weight * s.reps, 0);
    const maxWeight = Math.max(...sets.map((s: any) => s.weight));
    const totalReps = sets.reduce((sum: number, s: any) => sum + s.reps, 0);

    history.push({
      date: exercise.date,
      totalVolume,
      maxWeight,
      totalReps,
      sets: sets.map((s: any) => ({
        ...s,
        isWarmup: s.isWarmup === 1,
      })),
    });
  }

  return history;
};

// Calculate total volume for a workout
export const calculateWorkoutVolume = (workout: Workout): number => {
  return workout.exercises.reduce((total, exercise) => {
    const exerciseVolume = exercise.sets
      .filter((set) => !set.isWarmup)
      .reduce((sum, set) => sum + set.weight * set.reps, 0);
    return total + exerciseVolume;
  }, 0);
};

// Get weekly volume
export const getWeeklyVolume = async (): Promise<number> => {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const workouts = await getWorkoutsByDateRange(
    weekAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  );

  return workouts.reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);
};

// Get workout count for current month
export const getMonthlyWorkoutCount = async (): Promise<number> => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const result = await getFirst<{ count: number }>(
    `SELECT COUNT(*) as count FROM workouts WHERE date >= ?`,
    [firstOfMonth.toISOString().split('T')[0]]
  );

  return result?.count || 0;
};

// Get total lifetime volume
export const getTotalLifetimeVolume = async (): Promise<number> => {
  const result = await getFirst<{ total: number }>(
    `SELECT SUM(s.weight * s.reps) as total
     FROM sets s
     JOIN exercises e ON s.exerciseId = e.id
     WHERE s.isWarmup = 0`
  );

  return result?.total || 0;
};

// Check and update personal records
const checkAndUpdatePR = async (
  exerciseLibraryId: string,
  weight: number,
  reps: number,
  date: string,
  workoutId: string,
  setId: string
): Promise<void> => {
  // Calculate estimated 1RM using Brzycki formula
  const estimated1RM = reps === 1 ? weight : weight * (36 / (37 - reps));

  // Check max weight PR
  const currentMaxWeight = await getFirst<PersonalRecord>(
    `SELECT * FROM personal_records
     WHERE exerciseLibraryId = ? AND recordType = 'max_weight'
     ORDER BY value DESC LIMIT 1`,
    [exerciseLibraryId]
  );

  if (!currentMaxWeight || weight > currentMaxWeight.value) {
    await runQuery(
      `INSERT INTO personal_records (id, exerciseLibraryId, recordType, value, weight, reps, date, workoutId, setId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), exerciseLibraryId, 'max_weight', weight, weight, reps, date, workoutId, setId]
    );
  }

  // Check 1RM PR
  const current1RM = await getFirst<PersonalRecord>(
    `SELECT * FROM personal_records
     WHERE exerciseLibraryId = ? AND recordType = '1rm'
     ORDER BY value DESC LIMIT 1`,
    [exerciseLibraryId]
  );

  if (!current1RM || estimated1RM > current1RM.value) {
    await runQuery(
      `INSERT INTO personal_records (id, exerciseLibraryId, recordType, value, weight, reps, date, workoutId, setId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), exerciseLibraryId, '1rm', estimated1RM, weight, reps, date, workoutId, setId]
    );
  }

  // Check rep-specific PRs (3RM, 5RM, 10RM)
  const repPRTypes: { reps: number; type: PRType }[] = [
    { reps: 3, type: '3rm' },
    { reps: 5, type: '5rm' },
    { reps: 10, type: '10rm' },
  ];

  for (const { reps: targetReps, type } of repPRTypes) {
    if (reps >= targetReps) {
      const currentRepPR = await getFirst<PersonalRecord>(
        `SELECT * FROM personal_records
         WHERE exerciseLibraryId = ? AND recordType = ?
         ORDER BY value DESC LIMIT 1`,
        [exerciseLibraryId, type]
      );

      if (!currentRepPR || weight > currentRepPR.value) {
        await runQuery(
          `INSERT INTO personal_records (id, exerciseLibraryId, recordType, value, weight, reps, date, workoutId, setId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), exerciseLibraryId, type, weight, weight, reps, date, workoutId, setId]
        );
      }
    }
  }
};

// Get personal records for an exercise
export const getExercisePRs = async (exerciseLibraryId: string): Promise<PersonalRecord[]> => {
  return getAll<PersonalRecord>(
    `SELECT * FROM personal_records
     WHERE exerciseLibraryId = ?
     ORDER BY date DESC`,
    [exerciseLibraryId]
  );
};

// Delete a workout
export const deleteWorkout = async (workoutId: string): Promise<void> => {
  await runQuery('DELETE FROM workouts WHERE id = ?', [workoutId]);
};

// Get workout count
export const getTotalWorkoutCount = async (): Promise<number> => {
  const result = await getFirst<{ count: number }>(
    'SELECT COUNT(*) as count FROM workouts'
  );
  return result?.count || 0;
};
