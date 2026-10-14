import { MuscleGroup } from '../types';

export type BuiltInTemplateLevel = 'Beginner' | 'Intermediate';

export interface BuiltInTemplateDefinition {
  id: string;
  name: string;
  description: string;
  level: BuiltInTemplateLevel;
  schedule: string;
  exercises: Array<{
    exerciseName: string;
    muscleGroups: MuscleGroup[];
    defaultSets: number;
    defaultReps: number;
  }>;
}

// Large, multi-joint movements come first and most exercises use 2–3 working
// sets. Full Body A/B are meant to alternate; the other sessions are designed
// to be used with their matching split.
export const builtInWorkoutTemplates: BuiltInTemplateDefinition[] = [
  {
    id: 'builtin-full-body-a',
    name: 'Full Body A',
    description: 'A balanced foundation built around squat, press, and pull patterns.',
    level: 'Beginner',
    schedule: '3-day plan',
    exercises: [
      { exerciseName: 'Barbell Back Squat', muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'core'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Barbell Bench Press', muscleGroups: ['chest', 'triceps', 'shoulders'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Barbell Row', muscleGroups: ['back', 'biceps', 'lats'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Romanian Deadlift', muscleGroups: ['hamstrings', 'glutes', 'lower_back'], defaultSets: 2, defaultReps: 10 },
      { exerciseName: 'Lateral Raise', muscleGroups: ['shoulders'], defaultSets: 2, defaultReps: 12 },
    ],
  },
  {
    id: 'builtin-full-body-b',
    name: 'Full Body B',
    description: 'The companion session: hinge, overhead press, vertical pull, and single-leg work.',
    level: 'Beginner',
    schedule: '3-day plan',
    exercises: [
      { exerciseName: 'Deadlift', muscleGroups: ['back', 'hamstrings', 'glutes', 'core', 'traps'], defaultSets: 2, defaultReps: 6 },
      { exerciseName: 'Overhead Press', muscleGroups: ['shoulders', 'triceps', 'core'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Lat Pulldown', muscleGroups: ['lats', 'biceps', 'back'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Bulgarian Split Squat', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Dumbbell Bench Press', muscleGroups: ['chest', 'triceps', 'shoulders'], defaultSets: 2, defaultReps: 10 },
    ],
  },
  {
    id: 'builtin-upper-strength',
    name: 'Upper Strength',
    description: 'Heavier upper-body compounds with enough pulling to keep the session balanced.',
    level: 'Intermediate',
    schedule: '4-day plan',
    exercises: [
      { exerciseName: 'Barbell Bench Press', muscleGroups: ['chest', 'triceps', 'shoulders'], defaultSets: 3, defaultReps: 5 },
      { exerciseName: 'Barbell Row', muscleGroups: ['back', 'biceps', 'lats'], defaultSets: 3, defaultReps: 6 },
      { exerciseName: 'Overhead Press', muscleGroups: ['shoulders', 'triceps', 'core'], defaultSets: 3, defaultReps: 6 },
      { exerciseName: 'Pull-Ups', muscleGroups: ['lats', 'biceps', 'back'], defaultSets: 3, defaultReps: 6 },
      { exerciseName: 'Face Pull', muscleGroups: ['shoulders', 'back', 'traps'], defaultSets: 2, defaultReps: 12 },
    ],
  },
  {
    id: 'builtin-lower-strength',
    name: 'Lower Strength',
    description: 'A squat-and-hinge strength day with unilateral and hamstring support work.',
    level: 'Intermediate',
    schedule: '4-day plan',
    exercises: [
      { exerciseName: 'Barbell Back Squat', muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'core'], defaultSets: 3, defaultReps: 5 },
      { exerciseName: 'Deadlift', muscleGroups: ['back', 'hamstrings', 'glutes', 'core', 'traps'], defaultSets: 2, defaultReps: 5 },
      { exerciseName: 'Bulgarian Split Squat', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Leg Curl', muscleGroups: ['hamstrings'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Standing Calf Raise', muscleGroups: ['calves'], defaultSets: 3, defaultReps: 12 },
    ],
  },
  {
    id: 'builtin-push',
    name: 'Push',
    description: 'Chest, shoulders, and triceps with compounds first and focused accessory volume.',
    level: 'Intermediate',
    schedule: '3–6 day plan',
    exercises: [
      { exerciseName: 'Barbell Bench Press', muscleGroups: ['chest', 'triceps', 'shoulders'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Incline Dumbbell Press', muscleGroups: ['chest', 'triceps', 'shoulders'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Overhead Press', muscleGroups: ['shoulders', 'triceps', 'core'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Lateral Raise', muscleGroups: ['shoulders'], defaultSets: 3, defaultReps: 12 },
      { exerciseName: 'Tricep Pushdown', muscleGroups: ['triceps'], defaultSets: 3, defaultReps: 10 },
    ],
  },
  {
    id: 'builtin-pull',
    name: 'Pull',
    description: 'Vertical and horizontal pulling for the back, rear shoulders, and biceps.',
    level: 'Intermediate',
    schedule: '3–6 day plan',
    exercises: [
      { exerciseName: 'Pull-Ups', muscleGroups: ['lats', 'biceps', 'back'], defaultSets: 3, defaultReps: 6 },
      { exerciseName: 'Barbell Row', muscleGroups: ['back', 'biceps', 'lats'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Lat Pulldown', muscleGroups: ['lats', 'biceps', 'back'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Seated Cable Row', muscleGroups: ['back', 'biceps', 'lats'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Face Pull', muscleGroups: ['shoulders', 'back', 'traps'], defaultSets: 3, defaultReps: 12 },
      { exerciseName: 'Dumbbell Curl', muscleGroups: ['biceps'], defaultSets: 3, defaultReps: 10 },
    ],
  },
  {
    id: 'builtin-legs',
    name: 'Legs',
    description: 'Quads, hamstrings, glutes, and calves in one complete lower-body session.',
    level: 'Intermediate',
    schedule: '3–6 day plan',
    exercises: [
      { exerciseName: 'Barbell Back Squat', muscleGroups: ['quadriceps', 'glutes', 'hamstrings', 'core'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Romanian Deadlift', muscleGroups: ['hamstrings', 'glutes', 'lower_back'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Leg Press', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], defaultSets: 3, defaultReps: 10 },
      { exerciseName: 'Bulgarian Split Squat', muscleGroups: ['quadriceps', 'glutes', 'hamstrings'], defaultSets: 3, defaultReps: 8 },
      { exerciseName: 'Leg Curl', muscleGroups: ['hamstrings'], defaultSets: 3, defaultReps: 12 },
      { exerciseName: 'Standing Calf Raise', muscleGroups: ['calves'], defaultSets: 3, defaultReps: 12 },
    ],
  },
];
