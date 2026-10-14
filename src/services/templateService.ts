import { v4 as uuidv4 } from 'uuid';
import { WorkoutTemplate, TemplateExercise, MuscleGroup } from '../types';
import { getAll, getFirst, runQuery } from '../database/database';
import { builtInWorkoutTemplates } from '../data/builtInWorkoutTemplates';

interface TemplateExerciseInput {
  exerciseLibraryId: string;
  exerciseName: string;
  muscleGroups: MuscleGroup[];
  defaultSets: number;
  defaultReps?: number;
  defaultWeight?: number;
}

const getBuiltInTemplates = async (): Promise<WorkoutTemplate[]> => {
  const libraryExercises = await getAll<{ id: string; name: string }>(
    'SELECT id, name FROM exercise_library'
  );
  const exerciseIds = new Map(libraryExercises.map((exercise) => [exercise.name, exercise.id]));
  const seededAt = '2026-01-01T00:00:00.000Z';

  return builtInWorkoutTemplates.map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    level: definition.level,
    schedule: definition.schedule,
    isBuiltIn: true,
    createdAt: seededAt,
    updatedAt: seededAt,
    exercises: definition.exercises
      .filter((exercise) => exerciseIds.has(exercise.exerciseName))
      .map((exercise, orderIndex) => ({
        id: `${definition.id}-${orderIndex}`,
        templateId: definition.id,
        exerciseLibraryId: exerciseIds.get(exercise.exerciseName) as string,
        exerciseName: exercise.exerciseName,
        muscleGroups: exercise.muscleGroups,
        orderIndex,
        defaultSets: exercise.defaultSets,
        defaultReps: exercise.defaultReps,
      })),
  }));
};

export const createTemplate = async (
  name: string,
  exercises: TemplateExerciseInput[]
): Promise<WorkoutTemplate> => {
  const templateId = uuidv4();
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO workout_templates (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
    [templateId, name, now, now]
  );

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    await runQuery(
      `INSERT INTO template_exercises (id, templateId, exerciseLibraryId, exerciseName, muscleGroups, orderIndex, defaultSets, defaultReps, defaultWeight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        templateId,
        ex.exerciseLibraryId,
        ex.exerciseName,
        ex.muscleGroups.join(','),
        i,
        ex.defaultSets,
        ex.defaultReps ?? null,
        ex.defaultWeight ?? null,
      ]
    );
  }

  return getTemplateById(templateId) as Promise<WorkoutTemplate>;
};

export const getTemplates = async (): Promise<WorkoutTemplate[]> => {
  const rows = await getAll<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>('SELECT * FROM workout_templates ORDER BY updatedAt DESC');

  const templates: WorkoutTemplate[] = [];
  for (const row of rows) {
    const exercises = await getTemplateExercises(row.id);
    templates.push({ ...row, exercises, isBuiltIn: false });
  }
  return [...await getBuiltInTemplates(), ...templates];
};

export const getTemplateById = async (id: string): Promise<WorkoutTemplate | null> => {
  if (id.startsWith('builtin-')) {
    const templates = await getBuiltInTemplates();
    return templates.find((template) => template.id === id) || null;
  }

  const row = await getFirst<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>('SELECT * FROM workout_templates WHERE id = ?', [id]);

  if (!row) return null;

  const exercises = await getTemplateExercises(id);
  return { ...row, exercises, isBuiltIn: false };
};

const getTemplateExercises = async (templateId: string): Promise<TemplateExercise[]> => {
  const rows = await getAll<{
    id: string;
    templateId: string;
    exerciseLibraryId: string;
    exerciseName: string;
    muscleGroups: string;
    orderIndex: number;
    defaultSets: number;
    defaultReps: number | null;
    defaultWeight: number | null;
  }>(
    'SELECT * FROM template_exercises WHERE templateId = ? ORDER BY orderIndex',
    [templateId]
  );

  return rows.map((row) => ({
    ...row,
    muscleGroups: row.muscleGroups.split(',') as MuscleGroup[],
    defaultReps: row.defaultReps ?? undefined,
    defaultWeight: row.defaultWeight ?? undefined,
  }));
};

export const deleteTemplate = async (id: string): Promise<void> => {
  if (id.startsWith('builtin-')) return;
  await runQuery('DELETE FROM template_exercises WHERE templateId = ?', [id]);
  await runQuery('DELETE FROM workout_templates WHERE id = ?', [id]);
};
