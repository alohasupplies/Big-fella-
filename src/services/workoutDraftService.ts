import { getFirst, runQuery } from '../database/database';

export interface DraftSet {
  id: string;
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
  completed: boolean;
}

export interface DraftExercise {
  id: string;
  exerciseLibraryId: string;
  exerciseName: string;
  muscleGroups: string[];
  sets: DraftSet[];
}

export interface WorkoutDraft {
  exercises: DraftExercise[];
  notes: string;
  weightUnit: 'lbs' | 'kg';
}

// Serialize writes and reads so a rapid edit, dismissal, and reopening cannot
// restore an older snapshot or recreate a discarded draft.
let pending: Promise<unknown> = Promise.resolve();
const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
};

export const saveWorkoutDraft = (draft: WorkoutDraft): Promise<void> => {
  const data = JSON.stringify(draft);
  return enqueue(async () => {
    await runQuery('INSERT OR REPLACE INTO workout_drafts (id, data) VALUES (?, ?)', ['active', data]);
  });
};

export const readWorkoutDraft = (): Promise<WorkoutDraft | null> => enqueue(async () => {
  const row = await getFirst<{ data: string }>('SELECT data FROM workout_drafts WHERE id = ?', ['active']);
  return row ? JSON.parse(row.data) as WorkoutDraft : null;
});

export const clearWorkoutDraft = (): Promise<void> => enqueue(async () => {
  await runQuery('DELETE FROM workout_drafts WHERE id = ?', ['active']);
});
