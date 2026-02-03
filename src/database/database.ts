import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!db) {
    db = SQLite.openDatabaseSync('bigfella.db');
  }
  return db;
};

export const initDatabase = async (): Promise<void> => {
  const database = getDatabase();

  // Create tables
  await database.execAsync(`
    -- User Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Exercise Library table
    CREATE TABLE IF NOT EXISTS exercise_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      alternativeNames TEXT,
      primaryMuscleGroup TEXT NOT NULL,
      secondaryMuscleGroups TEXT,
      equipment TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT,
      videoUrl TEXT,
      isCustom INTEGER DEFAULT 0
    );

    -- Workouts table
    CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      duration INTEGER,
      notes TEXT,
      tags TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    -- Exercises (workout entries) table
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      workoutId TEXT NOT NULL,
      exerciseLibraryId TEXT NOT NULL,
      exerciseName TEXT NOT NULL,
      muscleGroups TEXT NOT NULL,
      orderIndex INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (workoutId) REFERENCES workouts(id) ON DELETE CASCADE
    );

    -- Sets table
    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      exerciseId TEXT NOT NULL,
      setNumber INTEGER NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      rpe INTEGER,
      isWarmup INTEGER DEFAULT 0,
      notes TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (exerciseId) REFERENCES exercises(id) ON DELETE CASCADE
    );

    -- Runs table
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      distance REAL NOT NULL,
      duration INTEGER NOT NULL,
      pace REAL NOT NULL,
      routeName TEXT,
      runType TEXT NOT NULL,
      weather TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    -- Streaks table
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      startDate TEXT NOT NULL,
      endDate TEXT,
      currentLength INTEGER NOT NULL,
      isActive INTEGER NOT NULL,
      freezesUsed INTEGER DEFAULT 0
    );

    -- Streak Freezes table
    CREATE TABLE IF NOT EXISTS streak_freezes (
      id TEXT PRIMARY KEY,
      streakId TEXT NOT NULL,
      date TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (streakId) REFERENCES streaks(id) ON DELETE CASCADE
    );

    -- Personal Records table
    CREATE TABLE IF NOT EXISTS personal_records (
      id TEXT PRIMARY KEY,
      exerciseLibraryId TEXT NOT NULL,
      recordType TEXT NOT NULL,
      value REAL NOT NULL,
      weight REAL,
      reps INTEGER,
      date TEXT NOT NULL,
      workoutId TEXT,
      setId TEXT,
      FOREIGN KEY (workoutId) REFERENCES workouts(id) ON DELETE SET NULL
    );

    -- Challenges table
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      targetValue REAL NOT NULL,
      currentValue REAL DEFAULT 0,
      unit TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      isCompleted INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    -- Badges table
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      iconName TEXT NOT NULL,
      earnedDate TEXT,
      isEarned INTEGER DEFAULT 0
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
    CREATE INDEX IF NOT EXISTS idx_exercises_workout ON exercises(workoutId);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exerciseId);
    CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);
    CREATE INDEX IF NOT EXISTS idx_personal_records_exercise ON personal_records(exerciseLibraryId);
  `);

  // Initialize default settings if not exists
  await initializeDefaultSettings(database);

  // Initialize exercise library if empty
  await initializeExerciseLibrary(database);

  // Initialize badges if empty
  await initializeBadges(database);
};

const initializeDefaultSettings = async (database: SQLite.SQLiteDatabase) => {
  const defaultSettings = [
    { key: 'weightUnit', value: 'lbs' },
    { key: 'distanceUnit', value: 'miles' },
    { key: 'streakMinDistance', value: '0' },
    { key: 'streakMinDuration', value: '0' },
    { key: 'streakGracePeriod', value: '2' },
    { key: 'runReminderEnabled', value: 'true' },
    { key: 'runReminderTime', value: '20:00' },
    { key: 'workoutReminderEnabled', value: 'false' },
    { key: 'darkMode', value: 'system' },
    { key: 'monthlyFreezes', value: '2' },
  ];

  for (const setting of defaultSettings) {
    await database.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value]
    );
  }
};

const initializeExerciseLibrary = async (database: SQLite.SQLiteDatabase) => {
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercise_library'
  );

  if (result && result.count === 0) {
    // Import exercises from the exercise data file
    const { exerciseLibrary } = await import('../data/exerciseLibrary');

    for (const exercise of exerciseLibrary) {
      await database.runAsync(
        `INSERT INTO exercise_library (id, name, alternativeNames, primaryMuscleGroup,
         secondaryMuscleGroups, equipment, category, tags, videoUrl, isCustom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          exercise.id,
          exercise.name,
          exercise.alternativeNames?.join(',') || null,
          exercise.primaryMuscleGroup,
          exercise.secondaryMuscleGroups?.join(',') || null,
          exercise.equipment,
          exercise.category,
          exercise.tags?.join(',') || null,
          exercise.videoUrl || null,
          0,
        ]
      );
    }
  }
};

const initializeBadges = async (database: SQLite.SQLiteDatabase) => {
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM badges'
  );

  if (result && result.count === 0) {
    const { badges } = await import('../data/badges');

    for (const badge of badges) {
      await database.runAsync(
        `INSERT INTO badges (id, name, description, category, iconName, isEarned)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [badge.id, badge.name, badge.description, badge.category, badge.iconName, 0]
      );
    }
  }
};

// Generic query helper functions
export const runQuery = async (sql: string, params: any[] = []) => {
  const database = getDatabase();
  return database.runAsync(sql, params);
};

export const getAll = async <T>(sql: string, params: any[] = []): Promise<T[]> => {
  const database = getDatabase();
  return database.getAllAsync<T>(sql, params);
};

export const getFirst = async <T>(sql: string, params: any[] = []): Promise<T | null> => {
  const database = getDatabase();
  return database.getFirstAsync<T>(sql, params);
};
