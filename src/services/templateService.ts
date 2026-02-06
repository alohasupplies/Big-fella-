import { v4 as uuidv4 } from 'uuid';
import { WorkoutTemplate, TemplateExercise, MuscleGroup } from '../types';
import { getAll, getFirst, runQuery } from '../database/database';

interface TemplateExerciseInput {
  exerciseLibraryId: string;
  exerciseName: string;
  muscleGroups: MuscleGroup[];
  defaultSets: number;
  defaultReps?: number;
  defaultWeight?: number;
}

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
    templates.push({ ...row, exercises });
  }
  return templates;
};

export const getTemplateById = async (id: string): Promise<WorkoutTemplate | null> => {
  const row = await getFirst<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>('SELECT * FROM workout_templates WHERE id = ?', [id]);

  if (!row) return null;

  const exercises = await getTemplateExercises(id);
  return { ...row, exercises };
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
  await runQuery('DELETE FROM template_exercises WHERE templateId = ?', [id]);
  await runQuery('DELETE FROM workout_templates WHERE id = ?', [id]);
};
