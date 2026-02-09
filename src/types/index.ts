// Data Models for Big Fella Athletics

// Exercise Library Types
export interface ExerciseLibraryItem {
  id: string;
  name: string;
  alternativeNames?: string[];
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  tags?: ExerciseTag[];
  videoUrl?: string;
  isCustom: boolean;
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'hip_flexors'
  | 'traps'
  | 'lats'
  | 'lower_back'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'resistance_band'
  | 'ez_bar'
  | 'trap_bar'
  | 'smith_machine'
  | 'other';

export type ExerciseCategory =
  | 'compound'
  | 'isolation'
  | 'bodyweight'
  | 'machine'
  | 'cardio'
  | 'plyometric';

export type ExerciseTag =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'push'
  | 'pull'
  | 'legs'
  | 'core'
  | 'compound'
  | 'isolation';

// Workout Types
export interface Workout {
  id: string;
  date: string; // ISO date string
  duration?: number; // in minutes
  notes?: string;
  tags?: string[];
  exercises: Exercise[];
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  workoutId: string;
  exerciseLibraryId: string;
  exerciseName: string;
  muscleGroups: MuscleGroup[];
  orderIndex: number;
  sets: Set[];
  notes?: string;
}

export interface Set {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number; // 1-10
  isWarmup: boolean;
  notes?: string;
  timestamp: string;
}

// Run Types
export interface Run {
  id: string;
  date: string;
  distance: number; // in user's preferred unit
  duration: number; // in seconds
  pace: number; // calculated: min per mile/km
  routeName?: string;
  runType: RunType;
  weather?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RunType = 'easy' | 'tempo' | 'intervals' | 'long' | 'recovery' | 'race' | 'walk';

// Streak Types
export interface Streak {
  id: string;
  startDate: string;
  endDate?: string;
  currentLength: number;
  isActive: boolean;
  freezesUsed: number;
}

export interface StreakFreeze {
  id: string;
  streakId: string;
  date: string;
  reason?: string;
}

// Personal Record Types
export interface PersonalRecord {
  id: string;
  exerciseLibraryId: string;
  recordType: PRType;
  value: number;
  weight?: number;
  reps?: number;
  date: string;
  workoutId?: string;
  setId?: string;
}

export type PRType = '1rm' | '3rm' | '5rm' | '10rm' | 'max_volume' | 'max_weight';

// Challenge Types
export interface Challenge {
  id: string;
  name: string;
  description?: string;
  type: ChallengeType;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  isCompleted: boolean;
  isActive: boolean;
  createdAt: string;
}

export type ChallengeType = 'distance' | 'streak' | 'frequency' | 'volume';

// Badge Types
export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  iconName: string;
  earnedDate?: string;
  isEarned: boolean;
}

export type BadgeCategory =
  | 'streak'
  | 'distance'
  | 'strength'
  | 'consistency'
  | 'speed'
  | 'dedication';

// Settings Types
export interface AppSettings {
  weightUnit: 'lbs' | 'kg';
  distanceUnit: 'miles' | 'km';
  streakMinDistance: number;
  streakMinDuration: number;
  streakGracePeriod: number; // hours
  runReminderEnabled: boolean;
  runReminderTime: string; // HH:MM format
  workoutReminderEnabled: boolean;
  darkMode: 'light' | 'dark' | 'system';
  monthlyFreezes: number;
  healthSyncEnabled: boolean;
  restTimerDefault: number; // seconds
}

// Analytics Types
export interface WeeklyStats {
  totalVolume: number;
  totalDistance: number;
  workoutCount: number;
  runCount: number;
  averagePace: number;
  currentStreak: number;
}

export interface ExerciseHistory {
  date: string;
  totalVolume: number;
  maxWeight: number;
  totalReps: number;
  sets: Set[];
}

// Progression Types
export interface ProgressionRecommendation {
  exerciseId: string;
  exerciseName: string;
  action: ProgressionAction;
  reason: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  suggestedSets?: number;
}

export type ProgressionAction =
  | 'add_weight'
  | 'add_reps'
  | 'add_sets'
  | 'maintain'
  | 'deload';

// Workout Template Types
export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseLibraryId: string;
  exerciseName: string;
  muscleGroups: MuscleGroup[];
  orderIndex: number;
  defaultSets: number;
  defaultReps?: number;
  defaultWeight?: number;
}

// Navigation Types
export type RootStackParamList = {
  Main: undefined;
  LogWorkout: { workoutId?: string; selectedExercises?: ExerciseLibraryItem[]; templateId?: string };
  LogRun: { runId?: string };
  ExerciseDetail: { exerciseLibraryId: string };
  WorkoutDetail: { workoutId: string };
  RunDetail: { runId: string; run: Run };
  ExerciseSearch: {};
  ChallengeDetail: { challengeId: string };
  CreateChallenge: undefined;
  Settings: undefined;
  DataExport: undefined;
};

export type TabParamList = {
  Home: undefined;
  Lift: undefined;
  Run: undefined;
  Progress: undefined;
  Profile: undefined;
};
